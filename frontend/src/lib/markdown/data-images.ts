/**
 * Streamdown (rehype-harden) hard-blocks `data:` image URIs and exposes no prop to allow
 * them — an inline base64 image an agent streams (e.g. a chart) renders as
 * "[Image blocked]". We deliberately opt those back in by rendering them OURSELVES,
 * outside Streamdown: split the markdown at each `![alt](data:image/…)` so the caller can
 * hand the surrounding text to Streamdown and draw the image with a plain `<img>`.
 *
 * Scope-limited to `data:image/…` (not arbitrary `data:` — no scripts/HTML). A base64
 * image loaded via `<img src>` is passive in every browser (no script execution, even for
 * SVG), so this does not reintroduce the XSS surface Streamdown's block guards against.
 *
 * Pure + string-only. Returns a single `md` segment (the whole input) when there are no
 * data images — the common case and every streaming frame before an image arrives.
 */

export type MarkdownSegment =
  | { type: "md"; text: string }
  | { type: "image"; alt: string; src: string };

/** `![alt](data:image/<type>;base64,<payload>)` — base64 has no `)`/whitespace, so the
 *  src stops cleanly at the closing paren. */
const DATA_IMAGE = /!\[([^\]]*)\]\((data:image\/[^)\s]+)\)/g;

export function splitDataImages(markdown: string): MarkdownSegment[] {
  const out: MarkdownSegment[] = [];
  let last = 0;
  for (const m of markdown.matchAll(DATA_IMAGE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: "md", text: markdown.slice(last, idx) });
    out.push({ type: "image", alt: m[1], src: m[2] });
    last = idx + m[0].length;
  }
  if (out.length === 0) return [{ type: "md", text: markdown }];
  if (last < markdown.length) out.push({ type: "md", text: markdown.slice(last) });
  return out;
}

export default splitDataImages;
