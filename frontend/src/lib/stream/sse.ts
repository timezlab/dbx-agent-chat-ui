import type { ChatStreamEvent } from "@/entities";

import { createResponsesParser } from "./responses";

/**
 * Pure: parse a recorded **Databricks Playground Responses** SSE stream → ordered
 * `ChatStreamEvent[]`. No I/O. The recording is the exact shape the real endpoint emits
 * (mock replays it; the live transport streams the same shape) — both funnel through
 * `createResponsesParser()` so there is ONE SSE handler (D3).
 *
 * SSE framing (contracts/chat-transport.md › Recording file format):
 *  - Frames separated by a blank line.
 *  - Each frame: optional `event:` line + one or more `data:` lines (concatenated).
 *  - `:`-comment lines (`:keepalive`) and payload-less frames are ignored.
 *  - The native Responses stream has no `[DONE]`, but a literal `data: [DONE]` is still
 *    accepted and maps to `{ type: "done" }` (forward-compatible).
 */
export function parseRecording(text: string): ChatStreamEvent[] {
  const parser = createResponsesParser();
  const events: ChatStreamEvent[] = [];

  for (const payload of extractDataPayloads(text)) {
    if (payload.trim() === "[DONE]") {
      events.push({ type: "done" });
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(payload);
    } catch {
      continue; // malformed frame → ignore
    }
    events.push(...parser.map(json));
  }

  return events;
}

/** Split raw SSE text into per-frame `data:` payloads (concatenated per the SSE spec). */
export function extractDataPayloads(text: string): string[] {
  const payloads: string[] = [];

  for (const frame of text.split(/\r?\n\r?\n/)) {
    const dataParts: string[] = [];
    for (const rawLine of frame.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (line.startsWith(":")) continue; // comment / keepalive
      if (line.startsWith("data:")) {
        dataParts.push(line.slice("data:".length).replace(/^ /, ""));
      }
    }
    if (dataParts.length > 0) payloads.push(dataParts.join("\n"));
  }

  return payloads;
}
