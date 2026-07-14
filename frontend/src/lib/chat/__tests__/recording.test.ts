import { describe, expect, it } from "vitest";

import {
  TEXT_DELAY_MS,
  TOOL_DELAY_MS,
  USER_REQUEST_FRAME_TYPE,
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
