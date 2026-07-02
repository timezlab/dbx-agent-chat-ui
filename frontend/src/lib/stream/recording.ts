// Shared, PURE recording-frame logic — the single source of truth for splitting a
// Responses-SSE recording into frames and pacing them (FR-017 / FR-018). Imported by
// BOTH the dev mock route (`app/api/chat/route.dev.ts`, server) and the client-side
// `streamReplay` (`lib/stream/replay.ts`, browser), so it MUST stay free of `node:*`
// imports and any other server-only dependency (Principle III — client-safe).

/** Default per-frame delays, matching the dev mock so replay pacing is familiar. */
export const TEXT_DELAY_MS = 20; // text streams fast
export const TOOL_DELAY_MS = 400; // tool events lag, so tool latency is visible

/** Per-frame timing overrides for {@link delayFor}. */
export interface FrameTiming {
  textDelayMs: number;
  toolDelayMs: number;
}

/** Split raw SSE text into frames, each carrying its concatenated `data:` payload. */
export function parseFrames(text: string): string[] {
  const frames: string[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const dataParts: string[] = [];
    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (line.startsWith(":")) continue; // comment / keepalive
      if (line.startsWith("data:")) {
        dataParts.push(line.slice("data:".length).replace(/^ /, ""));
      }
    }
    if (dataParts.length > 0) frames.push(dataParts.join("\n"));
  }
  return frames;
}

/**
 * Tool frames (function_call / function_call_output) stream slower than text. The
 * optional `timing` overrides the base delays (defaults to the module constants), so
 * replay can be sped up / slowed down without diverging from the mock's defaults.
 */
export function delayFor(
  payload: string,
  timing: FrameTiming = { textDelayMs: TEXT_DELAY_MS, toolDelayMs: TOOL_DELAY_MS },
): number {
  try {
    const json = JSON.parse(payload) as { item?: { type?: string } };
    const itemType = json.item?.type;
    if (itemType === "function_call" || itemType === "function_call_output") {
      return timing.toolDelayMs;
    }
  } catch {
    // non-JSON frame → treat as text
  }
  return timing.textDelayMs;
}
