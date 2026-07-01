/**
 * Streamdown renders markdown block-by-block (marked's `Lexer` → a separate React tree
 * per block), so a reference-link DEFINITION (`[w1]: https://…`) sitting in one block is
 * invisible to a reference USAGE (`[text][w1]`) in another block — the usage then renders
 * as raw source (`[[1] file.md][w1]`) instead of a link. We resolve the references into
 * inline links (`[text](https://…)`) and drop the now-unused definitions BEFORE handing
 * the text to Streamdown, so every block it parses is self-contained.
 *
 * Pure + string-only. Cheap no-op when the text carries no definitions (the common case,
 * and every streaming frame until the trailing definitions arrive).
 */

interface Definition {
  url: string;
  title?: string;
}

/** `[label]: url "optional title"` (also `'title'` / `(title)`, optional `<url>`). */
const DEFINITION =
  /^[ \t]{0,3}\[([^\]]+)\]:[ \t]*<?([^\s>]+)>?(?:[ \t]+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?[ \t]*$/;

/** Reference labels match case-insensitively with internal whitespace collapsed. */
function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function titleSuffix(def: Definition): string {
  return def.title ? ` "${def.title}"` : "";
}

export function resolveReferenceLinks(markdown: string): string {
  // 1) Collect definitions and strip their lines from the output.
  const defs = new Map<string, Definition>();
  const kept: string[] = [];
  for (const line of markdown.split("\n")) {
    const m = DEFINITION.exec(line);
    if (m) {
      defs.set(normalizeLabel(m[1]), {
        url: m[2],
        title: m[3] ?? m[4] ?? m[5],
      });
      continue;
    }
    kept.push(line);
  }
  if (defs.size === 0) return markdown; // nothing to resolve

  let text = kept.join("\n");

  // 2) Full / collapsed references: `[text][label]` or `[text][]`. The visible text may
  //    hold one level of balanced brackets (e.g. a citation marker "[1] file.md"). Skip
  //    reference images (`![text][label]`) — leave those untouched.
  const FULL = /(?<!!)\[((?:[^[\]]|\[[^[\]]*\])*)\]\[([^\]]*)\]/g;
  text = text.replace(FULL, (whole, visible: string, ref: string) => {
    const def = defs.get(normalizeLabel(ref.length ? ref : visible));
    return def ? `[${visible}](${def.url}${titleSuffix(def)})` : whole;
  });

  // 3) Shortcut references: a bare `[label]` for a defined label, not already part of an
  //    inline link/image/definition (guarded by the `(?![[(:])` lookahead).
  const SHORTCUT = /(!?)\[([^[\]]+)\](?![[(:])/g;
  text = text.replace(SHORTCUT, (whole, bang: string, label: string) => {
    if (bang) return whole; // reference image → leave alone
    const def = defs.get(normalizeLabel(label));
    return def ? `[${label}](${def.url}${titleSuffix(def)})` : whole;
  });

  return text;
}

export default resolveReferenceLinks;
