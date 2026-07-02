#!/usr/bin/env node

// Regenerate the committed default replay recording from a longer LOCAL capture, with all
// embedded base64 chart images stripped (FR-021 / FR-022 / SC-004). The committed
// `sse-recordings/default.txt` must stay small and text-only while remaining a realistic
// multi-tool, multi-turn stream.
//
// This script parses each SSE frame's JSON and removes base64 image markdown from string
// fields. It NEVER prints base64 to stdout — only frame/strip counts.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const DEFAULT_INPUT = resolve(scriptDir, "../sse-recordings/rbg-performance-2026.txt");
const DEFAULT_OUTPUT = resolve(scriptDir, "../sse-recordings/default.txt");

// Markdown image with a data: URI:  ![alt](data:image/png;base64,AAAA...)
const MD_IMAGE_RE = /!\[[^\]]*\]\(\s*data:[^)]*\)/gi;
// Chart link form:  [chart](data:...)
const CHART_LINK_RE = /\[chart\]\(\s*data:[^)]*\)/gi;
// Bare chart marker left behind:  [chart]
const CHART_MARKER_RE = /\[chart\]/gi;

/** Strip base64 image markdown from a single string value. Returns [clean, removedCount]. */
function stripString(value) {
  let removed = 0;
  const count = (re) => {
    const m = value.match(re);
    return m ? m.length : 0;
  };
  removed += count(MD_IMAGE_RE) + count(CHART_LINK_RE) + count(CHART_MARKER_RE);
  const clean = value
    .replace(MD_IMAGE_RE, "")
    .replace(CHART_LINK_RE, "")
    .replace(CHART_MARKER_RE, "");
  return [clean, removed];
}

/** Recursively strip image markdown from every string in a parsed JSON value. */
function stripValue(value, stats) {
  if (typeof value === "string") {
    const [clean, removed] = stripString(value);
    stats.stripped += removed;
    return clean;
  }
  if (Array.isArray(value)) return value.map((v) => stripValue(v, stats));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripValue(v, stats);
    return out;
  }
  return value;
}

/**
 * Strip base64 image markdown from a Responses-SSE recording. Operates per frame on
 * parsed JSON only; `data: [DONE]` and `:keepalive` lines pass through unchanged. Pure —
 * no I/O, no stdout.
 */
export function stripRecordingImages(text) {
  const stats = { frames: 0, stripped: 0 };
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const out = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("data:")) {
      const payload = trimmed.slice("data:".length).replace(/^\s+/, "");
      if (payload === "[DONE]") {
        out.push("data: [DONE]");
        continue;
      }
      try {
        const json = JSON.parse(payload);
        stats.frames += 1;
        const cleaned = stripValue(json, stats);
        out.push(`data: ${JSON.stringify(cleaned)}`);
        continue;
      } catch {
        // Non-JSON data frame — keep verbatim (no base64 to strip in practice).
        out.push(trimmed);
        continue;
      }
    }
    // Comment / keepalive / anything else → keep verbatim.
    out.push(trimmed);
  }

  return { output: out.join("\n\n") + "\n\n", ...stats };
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: node scripts/strip-recording-images.mjs [input] [output]");
    console.log(`Default input:  ${DEFAULT_INPUT}`);
    console.log(`Default output: ${DEFAULT_OUTPUT}`);
    process.exit(0);
  }
  return {
    inputPath: resolve(argv[0] ?? DEFAULT_INPUT),
    outputPath: resolve(argv[1] ?? DEFAULT_OUTPUT),
  };
}

// CLI entry — only when run directly, so the pure function stays importable in tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { inputPath, outputPath } = parseArgs(process.argv.slice(2));
  const input = await readFile(inputPath, "utf8");
  const result = stripRecordingImages(input);
  await writeFile(outputPath, result.output, "utf8");
  // NB: only counts — never the (possibly base64) payloads.
  console.log(
    `Stripped ${result.stripped} image marker(s) across ${result.frames} data frame(s) -> ${outputPath}`,
  );
}
