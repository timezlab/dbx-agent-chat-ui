import { describe, expect, it } from "vitest";

import {
  TEXT_DELAY_MS,
  TOOL_DELAY_MS,
  delayFor,
  parseFrames,
} from "@/lib/stream/recording";

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
