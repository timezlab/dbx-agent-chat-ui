// Shared, PURE recording-frame logic — the single source of truth for splitting a
// Responses-SSE recording into frames and pacing them (FR-017 / FR-018). Imported by
// BOTH the dev mock route (`app/api/chat/route.dev.ts`, server) and the client-side
// `streamReplay` (`lib/chat/replay.ts`, browser), so it MUST stay free of `node:*`
// imports and any other server-only dependency (Principle III — client-safe).

import type { Message, MessagePart, ToolActivityItem } from "@/entities";

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

// ─── SSE reconstruction (US5) ────────────────────────────────────────────────
// A downloaded recording is SYNTHESIZED from the reducer's already-reconciled
// `Message.parts[]` + `metrics`, NOT from the raw backend bytes. That makes the file
// coherent even when the live stream was interrupted + retried (the raw buffer would be
// truncated/spliced), and lets a turn loaded from History be downloaded at all — it never
// had a raw buffer. The frames re-parse through the SAME `createResponsesParser` +
// reducer path as live/replay, so a reconstructed recording rebuilds the exact turn.

// Synthetic item ids — cosmetic (the parser keys tokens/reasoning off nothing, tools off
// call_id). Stable strings keep a diffed recording readable.
const RECON_TEXT_ITEM_ID = "msg_reconstructed";
const RECON_REASONING_ITEM_ID = "rs_reconstructed";

/**
 * Split `text` into word-level chunks whose concatenation is byte-identical to `text`
 * (`chunks.join("") === text`). Each chunk is a run of non-whitespace plus its trailing
 * whitespace, so a base64 data URI (no interior whitespace) stays a single unbroken token
 * and markdown tables / code fences reassemble exactly. Word granularity gives replay a
 * natural typewriter cadence without exploding the file to per-character frames.
 */
export function chunkText(text: string): string[] {
  if (text === "") return [];
  const body = text.replace(/^\s+/, "");
  const lead = text.slice(0, text.length - body.length);
  const tokens: string[] = body.match(/\S+\s*/g) ?? (body ? [body] : []);
  if (lead) tokens.unshift(lead); // preserve any leading whitespace losslessly
  return tokens;
}

function textDeltaFrame(
  kind: "response.output_text.delta" | "response.reasoning_text.delta",
  itemId: string,
  delta: string,
): string {
  return JSON.stringify({ type: kind, item_id: itemId, delta });
}

/** A tool item → its `function_call` (running) + `function_call_output` (done) frame pair. */
function toolFrames(item: ToolActivityItem): string[] {
  const call = JSON.stringify({
    type: "response.output_item.done",
    item: {
      type: "function_call",
      id: item.id,
      call_id: item.id,
      name: item.name,
      arguments: JSON.stringify(item.args ?? {}),
      status: "completed",
    },
  });
  const output = JSON.stringify({
    type: "response.output_item.done",
    item: {
      type: "function_call_output",
      call_id: item.id,
      output: item.detail ?? "",
      ...(item.durationMs != null ? { duration_ms: item.durationMs } : {}),
    },
  });
  return [call, output];
}

/** Re-serialize a `suggestions` part as the `<suggested-followups>` block the reducer
 *  extracts on `done`. Emitted as a trailing text delta so it lands on the final text part. */
function suggestionsFrame(items: string[]): string {
  const xml =
    "\n\n<suggested-followups>\n" +
    items.map((q) => `<question>${q}</question>`).join("\n") +
    "\n</suggested-followups>";
  return textDeltaFrame("response.output_text.delta", RECON_TEXT_ITEM_ID, xml);
}

function partFrames(part: MessagePart): string[] {
  switch (part.type) {
    case "text":
      return chunkText(part.text).map((d) =>
        textDeltaFrame("response.output_text.delta", RECON_TEXT_ITEM_ID, d),
      );
    case "reasoning":
      return chunkText(part.text).map((d) =>
        textDeltaFrame("response.reasoning_text.delta", RECON_REASONING_ITEM_ID, d),
      );
    case "tools":
      return part.items.flatMap(toolFrames);
    case "suggestions":
      return [suggestionsFrame(part.items)];
    default:
      return [];
  }
}

/** Usage frame carrying the turn's metrics, mapped back to the snake_case wire fields the
 *  parser reads. Returns `null` when there is nothing numeric to report. */
function usageFrame(metrics: Message["metrics"]): string | null {
  if (!metrics) return null;
  const usage: Record<string, number> = {};
  if (metrics.inputTokens != null) usage.input_tokens = metrics.inputTokens;
  if (metrics.outputTokens != null) usage.output_tokens = metrics.outputTokens;
  if (metrics.totalTokens != null) usage.total_tokens = metrics.totalTokens;
  if (metrics.costUsd != null) usage.cost_usd = metrics.costUsd;
  if (metrics.durationMs != null) usage.duration_ms = metrics.durationMs;
  if (metrics.ttftMs != null) usage.ttft_ms = metrics.ttftMs;
  if (metrics.contextUsed != null) usage.context_used = metrics.contextUsed;
  if (metrics.contextWindow != null) usage.context_window = metrics.contextWindow;
  if (Object.keys(usage).length === 0) return null;
  return JSON.stringify({ type: "response.completed", response: { usage } });
}

/**
 * Synthesize the raw SSE frames (each the JSON `data:` payload, feed to
 * {@link serializeRecording}) for one settled assistant turn, from its reconciled
 * `parts[]` + `metrics`. Frame order mirrors a real Responses stream: content
 * (reasoning / text / tool pairs, in part order) → `response.completed` usage → the
 * `message` terminal that yields the single `done`. Usage precedes the terminal on
 * purpose: `streamReplay` stops at the first `done`, so a usage frame after it would be
 * dropped in playback (this matches the ordering in the default recording).
 */
export function buildRecordingFrames(message: Message): string[] {
  const frames = message.parts.flatMap(partFrames);

  const usage = usageFrame(message.metrics);
  if (usage) frames.push(usage);

  const fullText = message.parts
    .filter((p): p is Extract<MessagePart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
  frames.push(
    JSON.stringify({
      type: "response.output_item.done",
      item: { type: "message", id: RECON_TEXT_ITEM_ID, content: [{ text: fullText }] },
    }),
  );

  return frames;
}
