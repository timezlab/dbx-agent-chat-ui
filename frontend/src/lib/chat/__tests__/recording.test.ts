import { describe, expect, it } from "vitest";

import type { ChatSession, Message } from "@/entities";
import { createResponsesParser } from "@/lib/chat/responses";
import { reduceStreamEvent } from "@/lib/chat/reducer";
import {
  TEXT_DELAY_MS,
  TOOL_DELAY_MS,
  USER_REQUEST_FRAME_TYPE,
  buildRecordingFrames,
  delayFor,
  extractUserRequest,
  parseFrames,
  serializeRecording,
} from "@/lib/chat/recording";

describe("parseFrames", () => {
  it("splits blank-line-separated blocks into concatenated data payloads", () => {
    const text = 'data: {"a":1}\n\ndata: {"b":2}\n\n';
    expect(parseFrames(text)).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("strips a single leading space after `data:` and joins multi-line data", () => {
    const text = "data: line-1\ndata:line-2\n\n";
    expect(parseFrames(text)).toEqual(["line-1\nline-2"]);
  });

  it("ignores comment/keepalive lines and blocks with no data", () => {
    const text = ":keepalive\n\ndata: {\"x\":1}\n\n:comment\n\n";
    expect(parseFrames(text)).toEqual(['{"x":1}']);
  });

  it("returns an empty array for blank input", () => {
    expect(parseFrames("")).toEqual([]);
    expect(parseFrames("\n\n\n")).toEqual([]);
  });

  it("handles CRLF newlines", () => {
    expect(parseFrames('data: {"a":1}\r\n\r\n')).toEqual(['{"a":1}']);
  });
});

describe("delayFor", () => {
  it("returns the tool delay for function_call / function_call_output frames", () => {
    expect(delayFor('{"item":{"type":"function_call"}}')).toBe(TOOL_DELAY_MS);
    expect(delayFor('{"item":{"type":"function_call_output"}}')).toBe(
      TOOL_DELAY_MS,
    );
  });

  it("returns the text delay for other / non-JSON frames", () => {
    expect(delayFor('{"type":"response.output_text.delta","delta":"hi"}')).toBe(
      TEXT_DELAY_MS,
    );
    expect(delayFor("[DONE]")).toBe(TEXT_DELAY_MS);
  });

  it("honors an optional timing override, defaulting to the constants", () => {
    const timing = { textDelayMs: 5, toolDelayMs: 50 };
    expect(delayFor('{"item":{"type":"function_call"}}', timing)).toBe(50);
    expect(delayFor('{"type":"x"}', timing)).toBe(5);
  });

  it("uses the built-in defaults 20 / 400 ms (parity with the mock)", () => {
    expect(TEXT_DELAY_MS).toBe(20);
    expect(TOOL_DELAY_MS).toBe(400);
  });
});

describe("extractUserRequest", () => {
  it("returns the text of a leading replay.user_request sentinel frame", () => {
    const rec =
      `data: {"type":"${USER_REQUEST_FRAME_TYPE}","text":"What is the YTD report?"}\n\n` +
      'data: {"type":"response.output_text.delta","delta":"Hi"}\n\n';
    expect(extractUserRequest(rec)).toBe("What is the YTD report?");
  });

  it("finds the sentinel even when it is not the first frame", () => {
    const rec =
      'data: {"type":"response.output_text.delta","delta":"Hi"}\n\n' +
      `data: {"type":"${USER_REQUEST_FRAME_TYPE}","text":"second"}\n\n`;
    expect(extractUserRequest(rec)).toBe("second");
  });

  it("returns null when there is no sentinel", () => {
    expect(
      extractUserRequest('data: {"type":"response.output_text.delta","delta":"Hi"}\n\n'),
    ).toBeNull();
    expect(extractUserRequest("")).toBeNull();
  });

  it("ignores a sentinel with a non-string / empty text", () => {
    expect(
      extractUserRequest(`data: {"type":"${USER_REQUEST_FRAME_TYPE}","text":42}\n\n`),
    ).toBeNull();
    expect(
      extractUserRequest(`data: {"type":"${USER_REQUEST_FRAME_TYPE}","text":""}\n\n`),
    ).toBeNull();
  });

  it("skips malformed frames without throwing", () => {
    const rec =
      "data: not-json\n\n" +
      `data: {"type":"${USER_REQUEST_FRAME_TYPE}","text":"ok"}\n\n`;
    expect(extractUserRequest(rec)).toBe("ok");
  });
});

describe("serializeRecording", () => {
  it("prepends a replay.user_request sentinel then each captured frame as an SSE block", () => {
    const out = serializeRecording("my question", [
      '{"type":"response.output_text.delta","delta":"A"}',
      '{"type":"response.output_text.delta","delta":"B"}',
    ]);
    expect(out).toBe(
      `data: {"type":"${USER_REQUEST_FRAME_TYPE}","text":"my question"}\n\n` +
        'data: {"type":"response.output_text.delta","delta":"A"}\n\n' +
        'data: {"type":"response.output_text.delta","delta":"B"}\n\n',
    );
  });

  it("escapes the question so the sentinel stays valid JSON", () => {
    const out = serializeRecording('he said "hi"\nbye', []);
    const first = parseFrames(out)[0];
    expect(JSON.parse(first)).toEqual({
      type: USER_REQUEST_FRAME_TYPE,
      text: 'he said "hi"\nbye',
    });
  });

  it("round-trips through extractUserRequest", () => {
    const out = serializeRecording("round trip?", ['{"type":"x"}']);
    expect(extractUserRequest(out)).toBe("round trip?");
  });

  it("prefixes each line of a multi-line frame with data:", () => {
    const out = serializeRecording("q", ["line-1\nline-2"]);
    expect(out).toContain("data: line-1\ndata: line-2\n\n");
  });
});

describe("buildRecordingFrames", () => {
  /** Base assistant turn; callers override `parts` / `metrics`. */
  function assistant(overrides: Partial<Message> = {}): Message {
    return {
      id: "a1",
      role: "assistant",
      parts: [],
      attachments: [],
      status: "complete",
      error: null,
      feedback: null,
      createdAt: 0,
      ...overrides,
    };
  }

  /**
   * Drive the reconstructed frames through the SAME parser + reducer path replay uses,
   * returning the assembled assistant `Message`. This is the fidelity contract: replaying a
   * reconstructed recording must rebuild the exact turn the user saw.
   */
  function replayFrames(message: Message): Message {
    const frames = buildRecordingFrames(message);
    const parser = createResponsesParser();
    let session: ChatSession = {
      id: "s1",
      messages: [{ ...message, parts: [], metrics: undefined, status: "streaming" }],
      activeId: message.id,
      queue: [],
      status: "streaming",
    };
    for (const frame of frames) {
      for (const event of parser.map(JSON.parse(frame))) {
        session = reduceStreamEvent(session, event);
      }
    }
    return session.messages[0];
  }

  it("round-trips a text-only turn back to the same parts", () => {
    const msg = assistant({
      parts: [{ type: "text", text: "Hello **world**, this is a report." }],
    });
    const out = replayFrames(msg);
    expect(out.parts).toEqual(msg.parts);
    expect(out.status).toBe("complete");
  });

  it("chunks text word-by-word but keeps a base64 data URI and a markdown table intact", () => {
    const text =
      "| A | B |\n| - | - |\n| 1 | 2 |\n\n" +
      "![chart](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC)\n\n" +
      "Some trailing prose with several words here.";
    const msg = assistant({ parts: [{ type: "text", text }] });
    const frames = buildRecordingFrames(msg);
    // Word-level granularity: many small text deltas, not one giant frame.
    const textDeltas = frames
      .map((f) => JSON.parse(f))
      .filter((o) => o.type === "response.output_text.delta");
    expect(textDeltas.length).toBeGreaterThan(5);
    // The base64 data URI must survive as a single unbroken token (no whitespace inside it).
    expect(
      textDeltas.some((o: { delta: string }) =>
        o.delta.includes(
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
        ),
      ),
    ).toBe(true);
    // And the assembled text is byte-identical to the original.
    expect(replayFrames(msg).parts).toEqual(msg.parts);
  });

  it("round-trips interleaved reasoning, tools, and text in order", () => {
    const msg = assistant({
      parts: [
        { type: "reasoning", text: "Let me think about this carefully." },
        {
          type: "tools",
          items: [
            {
              id: "toolu_1",
              name: "write_todos",
              args: { todos: ["a", "b"] },
              detail: "done ✅",
              status: "done",
              durationMs: 40,
            },
          ],
        },
        { type: "text", text: "Here is the answer." },
      ],
    });
    expect(replayFrames(msg).parts).toEqual(msg.parts);
  });

  it("round-trips an inline `<suggested-followups>` block as plain reply text", () => {
    // Suggestions live in the text (rendered by Streamdown's custom-tag component), so the
    // recording carries them as ordinary text deltas — no special part to reconstruct.
    const msg = assistant({
      parts: [
        {
          type: "text",
          text:
            "The report is ready.\n\n<suggested-followups><question>Break down by region?</question><question>Show Q2 detail?</question></suggested-followups>",
        },
      ],
    });
    expect(replayFrames(msg).parts).toEqual(msg.parts);
  });

  it("emits usage before the terminal so metrics attach during replay", () => {
    const msg = assistant({
      parts: [{ type: "text", text: "Answer." }],
      metrics: { inputTokens: 8450, outputTokens: 2130, totalTokens: 10580, costUsd: 0.06 },
    });
    const out = replayFrames(msg);
    expect(out.parts).toEqual(msg.parts);
    expect(out.metrics).toEqual(msg.metrics);
  });

  it("produces a downloadable recording that embeds the question and re-parses", () => {
    const msg = assistant({ parts: [{ type: "text", text: "Four." }] });
    const recording = serializeRecording("What is 2 + 2?", buildRecordingFrames(msg));
    expect(extractUserRequest(recording)).toBe("What is 2 + 2?");
    // Frames round-trip through the plain frame splitter.
    expect(parseFrames(recording).length).toBeGreaterThan(1);
  });
});
