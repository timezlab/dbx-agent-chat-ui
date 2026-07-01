import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";

import type { ChatStreamHandlers } from "@/lib/chat/transport";
import { createResponsesParser } from "./responses";

/** Pull a human-readable server message out of a non-stream error response,
 *  preferring a JSON `{ detail }` / `{ error }` field, else raw text. */
async function readServerError(response: Response): Promise<string> {
  const fallback = `Chat request failed (${response.status})`;
  let text = "";
  try {
    text = await response.text();
  } catch {
    return fallback;
  }
  if (!text) return fallback;
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const detail = json.detail ?? json.error ?? json.message;
    if (typeof detail === "string" && detail) return detail;
  } catch {
    // not JSON — fall through to raw text
  }
  return text.slice(0, 500);
}

/**
 * Live SSE client over `@microsoft/fetch-event-source` (D3). POSTs a chat request to a
 * Databricks Playground-style endpoint and streams the **Responses** SSE shape, mapping
 * each frame → `ChatStreamEvent` through the shared `createResponsesParser()` — the exact
 * same handler the mock uses. Returns an `AbortController`; aborting stops the stream and
 * closes with "abort". Exactly one terminal (done/error/abort).
 *
 * No bundled secret (Principle II): auth, if any, is the deployment wrapper's concern via
 * same-origin cookies (`credentials: "include"`); this client embeds no credential.
 */
export interface StreamSSEOptions {
  url: string;
  body: unknown;
  handlers: ChatStreamHandlers;
  headers?: Record<string, string>;
  /** Injectable fetch (tests). Defaults to the global. */
  fetchImpl?: typeof fetch;
}

export function streamSSE(options: StreamSSEOptions): AbortController {
  const { url, body, handlers, headers, fetchImpl } = options;
  const controller = new AbortController();
  const parser = createResponsesParser();

  let closed = false;
  const close = (reason: "done" | "error" | "abort") => {
    if (closed) return;
    closed = true;
    handlers.onClose?.(reason);
  };
  const finish = (reason: "done" | "error") => {
    close(reason);
    controller.abort();
  };

  // External abort (user cancel) is swallowed by fetch-event-source — it resolves
  // without calling onerror/onclose — so we surface the terminal ourselves. When
  // finish() aborts, close() has already fired, so this is a no-op (idempotent).
  controller.signal.addEventListener("abort", () => close("abort"));

  void fetchEventSource(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
    credentials: "include",
    openWhenHidden: true,
    fetch: fetchImpl,
    async onopen(response) {
      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && contentType.includes(EventStreamContentType)) {
        return; // healthy stream — proceed to onmessage
      }
      // Surface a server-provided reason (e.g. auth / bad request) instead of a
      // generic network error. Throwing routes through onerror, which emits the
      // error event and rethrows to stop fetch-event-source auto-retry.
      throw new Error(
        response.ok
          ? `Unexpected response type: ${contentType || "unknown"}`
          : await readServerError(response),
      );
    },
    onmessage(ev) {
      if (closed) return;
      if (ev.data.trim() === "[DONE]") return finish("done");
      let json: unknown;
      try {
        json = JSON.parse(ev.data);
      } catch {
        return; // malformed frame → ignore
      }
      for (const event of parser.map(json)) {
        handlers.onEvent(event);
        if (event.type === "done") return finish("done");
        if (event.type === "error") return finish("error");
      }
    },
    onclose() {
      close("done"); // server closed the stream without an explicit terminal
    },
    onerror(err) {
      if (controller.signal.aborted) {
        close("abort");
      } else {
        handlers.onEvent({
          type: "error",
          message: err instanceof Error ? err.message : "Stream error",
        });
        close("error");
      }
      throw err; // stop fetch-event-source auto-retry (chat streams are single-shot)
    },
  }).catch(() => {
    // Rejection already surfaced via onerror/abort; ensure we always close.
    close(controller.signal.aborted ? "abort" : "error");
  });

  return controller;
}
