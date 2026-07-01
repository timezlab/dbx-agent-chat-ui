import type { ChatRequest, ChatStreamEvent } from "@/entities";
import { streamSSE } from "@/lib/stream/sse-client";

/**
 * Port hành vi cho chat backend (contracts/chat-transport.md). Component chỉ phụ thuộc
 * interface này; data type (`ChatRequest`/`ChatStreamEvent`) là entity (`@/entities`).
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

/**
 * Transport DUY NHẤT của app. FE luôn stream **1 endpoint** theo format Databricks
 * Playground (Responses SSE) qua `@microsoft/fetch-event-source` + parser dùng chung.
 * Endpoint đó là gì — Databricks thật, proxy, hay mock-api script — FE KHÔNG cần biết
 * (indistinguishable). Không có "mode". `endpointUrl` thiếu ⇒ `send` ném lỗi rõ ràng,
 * UI hiện inline (T055).
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
