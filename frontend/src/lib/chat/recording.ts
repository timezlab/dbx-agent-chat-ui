// Shared, PURE recording-frame logic — the single source of truth for splitting a
// Responses-SSE recording into frames and pacing them (FR-017 / FR-018). Imported by
// BOTH the dev mock route (`app/api/chat/route.dev.ts`, server) and the client-side
// `streamReplay` (`lib/chat/replay.ts`, browser), so it MUST stay free of `node:*`
// imports and any other server-only dependency (Principle III — client-safe).

/** Default per-frame delays, matching the dev mock so replay pacing is familiar. */
export const TEXT_DELAY_MS = 20; // text streams fast
export const TOOL_DELAY_MS = 400; // tool events lag, so tool latency is visible

/**
 * Sentinel frame `type` carrying the originating user question (US5 / FR-027). It is
 * metadata only: the SSE→event parser (`responses.ts`) ignores unknown types, so this frame
 * renders NO event — {@link extractUserRequest} reads it up front to label the replayed user
 * turn, and {@link serializeRecording} writes it when capturing a live turn to a `.txt`.
 */
export const USER_REQUEST_FRAME_TYPE = "replay.user_request";

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

/**
 * Read the embedded user question (FR-027/FR-028) from a recording, or `null` if none. Scans
 * frames for the {@link USER_REQUEST_FRAME_TYPE} sentinel and returns its non-empty `text`.
 * Malformed frames are skipped, never thrown — a recording without the sentinel (every legacy
 * `.txt`) simply yields `null`, and replay falls back to the filename placeholder.
 */
export function extractUserRequest(recording: string): string | null {
  for (const frame of parseFrames(recording)) {
    let json: unknown;
    try {
      json = JSON.parse(frame);
    } catch {
      continue;
    }
    if (
      json != null &&
      typeof json === "object" &&
      (json as { type?: unknown }).type === USER_REQUEST_FRAME_TYPE
    ) {
      const text = (json as { text?: unknown }).text;
      if (typeof text === "string" && text.length > 0) return text;
    }
  }
  return null;
}

/**
 * Build a replayable recording (FR-031) from a captured live turn: a leading
 * {@link USER_REQUEST_FRAME_TYPE} sentinel carrying `question`, then each raw SSE frame as its
 * own `data:` block. `JSON.stringify` escapes the question so the sentinel stays valid JSON;
 * multi-line frames get each line re-prefixed with `data:` so the SSE shape round-trips through
 * {@link parseFrames}.
 */
export function serializeRecording(question: string, frames: string[]): string {
  const toBlock = (payload: string): string =>
    payload
      .split(/\r?\n/)
      .map((line) => `data: ${line}`)
      .join("\n") + "\n\n";

  const header = JSON.stringify({ type: USER_REQUEST_FRAME_TYPE, text: question });
  return toBlock(header) + frames.map(toBlock).join("");
}
