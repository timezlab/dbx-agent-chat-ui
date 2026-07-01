import { describe, expect, it, vi } from "vitest";

import type { ChatStreamEvent } from "@/entities";
import { streamSSE } from "@/lib/stream/sse-client";

/** Build a Response whose body streams `body` as bytes (an SSE-over-HTTP reply). */
function sseResponse(
  body: string,
  { status = 200, contentType = "text/event-stream" } = {},
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { "Content-Type": contentType },
  });
}

/** Collect events + the single close reason for assertions. */
function collect() {
  const events: ChatStreamEvent[] = [];
  const state = { reason: undefined as "done" | "error" | "abort" | undefined };
  return {
    events,
    get closeReason() {
      return state.reason;
    },
    handlers: {
      onEvent: (e: ChatStreamEvent) => events.push(e),
      onClose: (r: "done" | "error" | "abort") => {
        state.reason = r;
      },
    },
  };
}

/** Wait until onClose has fired (or a short timeout elapses). */
async function until(pred: () => boolean, ms = 1000) {
  const start = Date.now();
  while (!pred() && Date.now() - start < ms) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

const RECORDING = [
  'data: {"type":"response.output_text.delta","item_id":"m","delta":"Hello"}',
  "",
  'data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"c1","name":"read_file","arguments":"{}","status":"completed"}}',
  "",
  'data: {"type":"response.output_item.done","item":{"id":"m","type":"message","content":[{"text":"Hello"}]}}',
  "",
  "", // trailing blank line — SSE dispatches a frame only on the blank-line boundary
].join("\n");

describe("streamSSE (live SSE client, injected fetch)", () => {
  it("maps a Databricks Responses stream to events and closes 'done'", async () => {
    const c = collect();
    const fetchImpl = vi.fn(async () => sseResponse(RECORDING)) as unknown as typeof fetch;

    streamSSE({
      url: "https://agent.example/invocations",
      body: { messages: [] },
      handlers: c.handlers,
      fetchImpl,
    });

    await until(() => c.closeReason !== undefined);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(c.events).toContainEqual({ type: "token", delta: "Hello" });
    expect(
      c.events.some((e) => e.type === "tool" && e.name === "read_file"),
    ).toBe(true);
    expect(c.events.at(-1)).toEqual({ type: "done" });
    expect(c.closeReason).toBe("done");
  });

  it("POSTs JSON with the event-stream Accept header", async () => {
    const c = collect();
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => sseResponse(RECORDING),
    );

    streamSSE({
      url: "https://agent.example/invocations",
      body: { messages: [{ role: "user", content: "hi" }] },
      handlers: c.handlers,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await until(() => c.closeReason !== undefined);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Accept).toBe(
      "text/event-stream",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("surfaces a server error (non-stream response) and closes 'error'", async () => {
    const c = collect();
    const fetchImpl = vi.fn(async () =>
      sseResponse(JSON.stringify({ detail: "unauthorized" }), {
        status: 401,
        contentType: "application/json",
      }),
    ) as unknown as typeof fetch;

    streamSSE({
      url: "https://agent.example/invocations",
      body: { messages: [] },
      handlers: c.handlers,
      fetchImpl,
    });
    await until(() => c.closeReason !== undefined);

    expect(c.events).toContainEqual({ type: "error", message: "unauthorized" });
    expect(c.closeReason).toBe("error");
  });

  it("closes 'abort' when the returned controller is aborted", async () => {
    const c = collect();
    // A never-ending stream so we abort mid-flight.
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>(() => {
          /* never resolves */
        }),
    ) as unknown as typeof fetch;

    const controller = streamSSE({
      url: "https://agent.example/invocations",
      body: { messages: [] },
      handlers: c.handlers,
      fetchImpl,
    });
    controller.abort();
    await until(() => c.closeReason !== undefined);

    expect(c.closeReason).toBe("abort");
  });
});
