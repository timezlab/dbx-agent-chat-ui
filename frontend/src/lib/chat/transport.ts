import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";

import type { ChatRequest, ChatStreamEvent } from "@/entities";
import { createResponsesParser } from "./responses";

/**
 * Port hành vi cho chat backend (contracts/chat-transport.md). Component chỉ phụ thuộc
 * interface này; data type (`ChatRequest`/`ChatStreamEvent`) là entity (`@/entities`).
 *
 * Chat transport KHÔNG phải một `ApiService` (axios): nó stream SSE qua
 * `@microsoft/fetch-event-source`. Toàn bộ SSE client (`streamSSE`) sống chung file này —
 * transport chỉ là lớp mỏng chọn endpoint rồi giao cho `streamSSE`.
 */

export interface ChatStreamHandlers {
  onEvent(event: ChatStreamEvent): void;
  /** Terminal convenience; gọi đúng 1 lần sau done/error/abort. */
  onClose?(reason: "done" | "error" | "abort"): void;
}

export interface ChatTransport {
  /** Bắt đầu 1 generation; trả AbortController để UI huỷ. */
  send(input: ChatRequest, handlers: ChatStreamHandlers): AbortController;
}

export type { ChatRequest, ChatStreamEvent };

/** A deterministic, non-transient failure (auth, bad request, wrong content
 *  type). Surfaced to the user immediately — reconnecting would just repeat it. */
class NonRetryableStreamError extends Error {
  readonly nonRetryable = true;
}

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
  /** Delay before a reconnect attempt, ms. Defaults to 2000. */
  retryDelayMs?: number;
}

export function streamSSE(options: StreamSSEOptions): AbortController {
  const { url, body, handlers, headers, fetchImpl, retryDelayMs = 500 } = options;
  const controller = new AbortController();
  const parser = createResponsesParser();

  let retryCount = 0;
  const maxRetries = 3;

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
      // generic network error. Throwing routes through onerror; the non-retryable
      // marker tells it to emit the error and rethrow rather than reconnect.
      throw new NonRetryableStreamError(
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
      // Reaching onclose means getBytes() returned — the server ended the
      // response body. If we already saw a terminal frame ([DONE]/done/error),
      // we're done. Otherwise the stream was cut short (e.g. the FastAPI proxy
      // closing before its 10-min timeout): fetch-event-source only reconnects
      // from the catch/onerror path, so throw to route there instead of
      // resolving silently (which would hang the UI with no terminal event).
      if (closed) return;
      throw new Error("Server closed stream before completion");
    },
    onerror(err) {
      if (controller.signal.aborted) {
        close("abort");
        throw err;
      }

      const isNonRetryable = err instanceof NonRetryableStreamError || closed;
      if (!isNonRetryable && retryCount < maxRetries) {
        retryCount++;
        console.warn(
          `Stream interrupted, reconnecting (${retryCount}/${maxRetries})...`,
          err,
        );
        // Returning a number schedules a reconnect after this many ms.
        return retryDelayMs;
      }

      // Non-retryable, or retries exhausted: surface the error and stop.
      handlers.onEvent({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Stream error (max retries reached)",
      });
      close("error");
      throw err;
    },
  }).catch(() => {
    // Rejection already surfaced via onerror/abort; ensure we always close.
    close(controller.signal.aborted ? "abort" : "error");
  });

  return controller;
}

/**
 * Transport DUY NHẤT của app. FE luôn stream **1 endpoint** theo format Databricks
 * Playground (Responses SSE) qua `streamSSE` + parser dùng chung. Endpoint đó là gì —
 * Databricks thật, proxy, hay mock-api script — FE KHÔNG cần biết (indistinguishable).
 * Không có "mode". `endpointUrl` thiếu ⇒ `send` ném lỗi rõ ràng, UI hiện inline (T055).
 */
export function createChatTransport(
  endpointUrl: string | undefined,
): ChatTransport {
  return {
    send(input, handlers) {
      if (!endpointUrl) {
        throw new Error(
          "Chat endpoint is not configured (NEXT_PUBLIC_CHAT_ENDPOINT_URL).",
        );
      }
      return streamSSE({ url: endpointUrl, body: input, handlers });
    },
  };
}
