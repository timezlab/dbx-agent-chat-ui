import { describe, expect, it } from "vitest";

import { splitDataImages } from "@/lib/markdown/data-images";

const PNG = "data:image/png;base64,iVBORw0KGgo+/=";
const SVG = "data:image/svg+xml;base64,PHN2Zz4=";

describe("splitDataImages", () => {
  it("returns the whole text as one md segment when there is no data image", () => {
    expect(splitDataImages("hello **world**")).toEqual([
      { type: "md", text: "hello **world**" },
    ]);
  });

  it("splits a single data image out of the surrounding markdown, in order", () => {
    const md = `intro\n\n![chart](${PNG})\n\noutro`;
    expect(splitDataImages(md)).toEqual([
      { type: "md", text: "intro\n\n" },
      { type: "image", alt: "chart", src: PNG },
      { type: "md", text: "\n\noutro" },
    ]);
  });

  it("handles multiple data images and preserves their order", () => {
    const md = `![a](${PNG}) mid ![b](${SVG})`;
    expect(splitDataImages(md)).toEqual([
      { type: "image", alt: "a", src: PNG },
      { type: "md", text: " mid " },
      { type: "image", alt: "b", src: SVG },
    ]);
  });

  it("leaves non-image data URIs and http images untouched (still Streamdown's job)", () => {
    const md = "![x](https://e.com/a.png) and [link](data:text/html,evil)";
    expect(splitDataImages(md)).toEqual([{ type: "md", text: md }]);
  });

  it("keeps an empty alt", () => {
    expect(splitDataImages(`![](${PNG})`)).toEqual([
      { type: "image", alt: "", src: PNG },
    ]);
  });
});
