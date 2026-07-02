import { describe, expect, it } from "vitest";

// @ts-expect-error — plain ESM script, no type declarations.
import { generateRecordingModule } from "../gen-replay-recording.mjs";

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
