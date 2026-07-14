import { describe, expect, it } from "vitest";

// @ts-expect-error — plain ESM script, no type declarations.
import { generateRecordingModule, withUserRequest } from "../gen-replay-recording.mjs";

describe("generateRecordingModule", () => {
  it("round-trips the recording text through the generated module string", () => {
    const recording = 'data: {"type":"x","delta":"héllo\\nworld"}\n\ndata: [DONE]\n\n';
    const mod = generateRecordingModule(recording);

    expect(mod).toContain("export const DEFAULT_REPLAY_RECORDING =");
    // The embedded literal must parse back to the exact original (JSON.stringify embed).
    const match = mod.match(/DEFAULT_REPLAY_RECORDING = (.*);\n?$/s);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1])).toBe(recording);
  });

  it("marks the file auto-generated so it is not hand-edited", () => {
    expect(generateRecordingModule("x")).toContain("AUTO-GENERATED");
  });
});

describe("withUserRequest", () => {
  const raw = 'data: {"type":"response.output_text.delta","delta":"Hi"}\n\n';

  it("prepends a replay.user_request sentinel frame carrying the question", () => {
    const out = withUserRequest(raw, "my question");
    expect(out.startsWith('data: {"type":"replay.user_request",')).toBe(true);
    expect(out).toContain('"text":"my question"');
    // The original recording is preserved after the injected frame.
    expect(out.endsWith(raw)).toBe(true);
    // Valid JSON sentinel (escaping via JSON.stringify).
    const firstLine = out.split("\n")[0].slice("data: ".length);
    expect(JSON.parse(firstLine)).toEqual({
      type: "replay.user_request",
      text: "my question",
    });
  });

  it("is idempotent — text already carrying the sentinel is returned unchanged", () => {
    const once = withUserRequest(raw, "q");
    expect(withUserRequest(once, "different")).toBe(once);
  });
});
