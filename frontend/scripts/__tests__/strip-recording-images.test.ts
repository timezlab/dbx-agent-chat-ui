import { describe, expect, it } from "vitest";

// @ts-expect-error — plain ESM script, no type declarations.
import { stripRecordingImages } from "../strip-recording-images.mjs";

const frame = (obj: unknown) => `data: ${JSON.stringify(obj)}`;

describe("stripRecordingImages", () => {
  it("removes base64 image markdown and leaves zero data:image payloads", () => {
    const input =
      frame({
        type: "response.output_text.delta",
        delta: "See ![chart](data:image/png;base64,AAAABBBBCCCC==) done.",
      }) + "\n\n";
    const { output } = stripRecordingImages(input);
    expect(output).not.toMatch(/data:image\/[^)]*base64/i);
    expect(output).not.toContain("AAAABBBBCCCC");
    // Surrounding prose is preserved.
    expect(output).toContain("See");
    expect(output).toContain("done.");
  });

  it("strips the [chart](data:...) link form and bare [chart] markers", () => {
    const input =
      frame({
        type: "response.output_item.done",
        item: {
          type: "message",
          content: [
            { type: "output_text", text: "[chart](data:image/png;base64,ZZZZ) [chart]" },
          ],
        },
      }) + "\n\n";
    const { output, stripped } = stripRecordingImages(input);
    expect(output).not.toContain("data:image");
    expect(output).not.toContain("ZZZZ");
    expect(output).not.toContain("[chart]");
    expect(stripped).toBeGreaterThanOrEqual(2);
  });

  it("passes through [DONE] and non-image frames unchanged in shape", () => {
    const input = frame({ type: "response.output_text.delta", delta: "hi" }) + "\n\ndata: [DONE]\n\n";
    const { output } = stripRecordingImages(input);
    expect(output).toContain('"delta":"hi"');
    expect(output).toContain("data: [DONE]");
  });
});
