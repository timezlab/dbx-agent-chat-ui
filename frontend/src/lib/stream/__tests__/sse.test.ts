import { describe, expect, it } from "vitest";

import { extractDataPayloads, parseRecording } from "@/lib/stream/sse";

/** Build a blank-line-separated SSE recording from raw data payloads. */
function recording(...payloads: string[]): string {
  return payloads.map((p) => `data: ${p}`).join("\n\n");
}

describe("parseRecording — Databricks Responses recordings", () => {
  it("maps output_text deltas + terminal message → tokens then done", () => {
    const text = recording(
      '{"type":"response.output_text.delta","item_id":"msg_1","delta":"Hello"}',
      '{"type":"response.output_text.delta","item_id":"msg_1","delta":", world"}',
      '{"type":"response.output_item.done","item":{"type":"message","id":"msg_1","content":[{"text":"Hello, world"}]}}',
    );
    expect(parseRecording(text)).toEqual([
      { type: "token", delta: "Hello" },
      { type: "token", delta: ", world" },
      { type: "done" },
    ]);
  });

  it("pairs a function_call with its function_call_output by call_id", () => {
    const text = recording(
      '{"type":"response.output_item.done","item":{"type":"function_call","call_id":"c1","name":"grep","arguments":"{\\"pattern\\":\\"x\\"}"}}',
      '{"type":"response.output_item.done","item":{"type":"function_call_output","call_id":"c1","output":"done"}}',
    );
    expect(parseRecording(text)).toEqual([
      { type: "tool", id: "c1", name: "grep", args: { pattern: "x" }, detail: undefined, status: "running" },
      { type: "tool", id: "c1", name: "grep", args: { pattern: "x" }, detail: "done", status: "done" },
    ]);
  });

  it("maps reasoning deltas → reasoning events", () => {
    const text = recording(
      '{"type":"response.reasoning_text.delta","item_id":"rs_1","delta":"hmm"}',
    );
    expect(parseRecording(text)).toEqual([{ type: "reasoning", delta: "hmm" }]);
  });

  it("accepts a literal [DONE] terminal (forward-compatible)", () => {
    expect(parseRecording("data: [DONE]")).toEqual([{ type: "done" }]);
  });

  it("ignores keepalive comments, lifecycle events, and malformed frames", () => {
    const text = [
      ":keepalive",
      "",
      'data: {"type":"response.created"}',
      "",
      'data: {"type":"response.output_text.delta","item_id":"m","delta":"kept"}',
      "",
      "data: {not json}",
      "",
    ].join("\n");
    expect(parseRecording(text)).toEqual([{ type: "token", delta: "kept" }]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseRecording("")).toEqual([]);
    expect(parseRecording("\n\n")).toEqual([]);
  });
});

describe("extractDataPayloads", () => {
  it("concatenates multiple data lines in one frame", () => {
    expect(extractDataPayloads('data: {"a":\ndata: 1}')).toEqual(['{"a":\n1}']);
  });

  it("skips comment and payload-less frames", () => {
    expect(extractDataPayloads(":ka\n\nevent: ping\n\ndata: x")).toEqual(["x"]);
  });
});
