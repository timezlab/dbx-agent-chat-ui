import { describe, expect, it } from "vitest";

import { resolveReferenceLinks } from "@/lib/markdown/reference-links";

describe("resolveReferenceLinks", () => {
  it("returns the text unchanged when there are no definitions", () => {
    const md = "See [text][w1] with no definition.";
    expect(resolveReferenceLinks(md)).toBe(md);
  });

  it("inlines a full reference and drops its definition line", () => {
    const md = ["A [docs][w1] link.", "", '[w1]: https://e.com "T"'].join("\n");
    expect(resolveReferenceLinks(md)).toBe('A [docs](https://e.com "T") link.\n');
  });

  it("resolves references whose text holds a nested citation bracket", () => {
    // The exact shape emitted by the RBG report: `[[1] file.md][w1]`.
    const md = [
      "**Sources**",
      "[[1] banca-insurance-h1-2026.md][w1]",
      "[[2] lending-bond-retention-2026.md][w2]",
      "",
      "[w1]: https://dbc.example.com/a.md",
      "[w2]: https://dbc.example.com/b.md",
    ].join("\n");
    const out = resolveReferenceLinks(md);
    expect(out).toContain(
      "[[1] banca-insurance-h1-2026.md](https://dbc.example.com/a.md)",
    );
    expect(out).toContain(
      "[[2] lending-bond-retention-2026.md](https://dbc.example.com/b.md)",
    );
    expect(out).not.toContain("[w1]");
    expect(out).not.toContain("[w2]:");
  });

  it("matches labels case-insensitively with collapsed whitespace", () => {
    const md = ["[x][My Ref] y", "", "[my  ref]: https://e.com"].join("\n");
    expect(resolveReferenceLinks(md)).toBe("[x](https://e.com) y\n");
  });

  it("leaves inline links, task-list boxes and undefined shortcuts untouched", () => {
    const md = [
      "- [ ] todo",
      "[chart] placeholder",
      "[click](https://e.com)",
      "",
      "[w1]: https://e.com",
    ].join("\n");
    const out = resolveReferenceLinks(md);
    expect(out).toContain("- [ ] todo");
    expect(out).toContain("[chart] placeholder");
    expect(out).toContain("[click](https://e.com)");
  });
});
