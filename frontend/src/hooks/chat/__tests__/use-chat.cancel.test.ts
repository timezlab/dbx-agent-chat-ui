import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CapabilityConfig } from "@/entities";
import type { ChatStreamHandlers, ChatTransport } from "@/lib/chat/transport";
import { useChat } from "@/hooks/chat/use-chat";

const config: CapabilityConfig = {
  chatEndpointUrl: "https://agent.example/invocations",
};

/**
 * A transport the test drives by hand: it captures the per-generation handlers and
 * returns an AbortController that, when aborted, fires `onClose("abort")` — exactly
 * how the live SSE client surfaces a user cancel.
 */
function controllable() {
  const state = {
    handlers: null as ChatStreamHandlers | null,
    controller: null as AbortController | null,
    sends: 0,
  };
  const transport: ChatTransport = {
    send: (_input, handlers) => {
      state.handlers = handlers;
      state.sends += 1;
      const controller = new AbortController();
      controller.signal.addEventListener("abort", () =>
        handlers.onClose?.("abort"),
      );
      state.controller = controller;
      return controller;
    },
  };
  return { transport, state };
}

describe("useChat — cancel a generation (US2)", () => {
  it("abort keeps partial output and marks the message stopped", () => {
    const { transport, state } = controllable();
    const { result } = renderHook(() => useChat({ config, transport }));

    act(() => result.current.send("hi"));
    act(() => state.handlers!.onEvent({ type: "token", delta: "par" }));
    act(() => state.handlers!.onEvent({ type: "token", delta: "tial" }));

    act(() => result.current.cancel());

    const assistant = result.current.messages.find((m) => m.role === "assistant");
    expect(assistant?.status).toBe("stopped");
    expect(assistant?.parts).toEqual([{ type: "text", text: "partial" }]);
    expect(result.current.status).toBe("idle");
  });

  it("cancel is idempotent at start (idle) and after a generation ends", () => {
    const { transport, state } = controllable();
    const { result } = renderHook(() => useChat({ config, transport }));

    // Idle: cancel does nothing, does not throw.
    expect(() => act(() => result.current.cancel())).not.toThrow();
    expect(result.current.messages).toHaveLength(0);

    // Run a generation to completion, then cancel again — no state churn.
    act(() => result.current.send("hi"));
    act(() => state.handlers!.onEvent({ type: "token", delta: "done" }));
    act(() => state.handlers!.onEvent({ type: "done" }));
    const before = result.current.messages;
    expect(() => act(() => result.current.cancel())).not.toThrow();
    expect(result.current.messages).toBe(before);
  });

  it("marks a message sent mid-stream as queued, then promotes it on dispatch", () => {
    const { transport, state } = controllable();
    const { result } = renderHook(() => useChat({ config, transport }));

    act(() => result.current.send("first"));
    act(() => state.handlers!.onEvent({ type: "token", delta: "partial" }));
    // Second send while streaming → held in the queue, shown dimmed ("queued").
    act(() => result.current.send("second"));

    const queued = result.current.messages.find(
      (m) => m.role === "user" && m.parts[0]?.type === "text" &&
        m.parts[0].text === "second",
    );
    expect(queued?.status).toBe("queued");

    // First generation ends (stream closes) → the queued turn dispatches and un-dims.
    act(() => {
      state.handlers!.onEvent({ type: "done" });
      state.handlers!.onClose?.("done");
    });
    const promoted = result.current.messages.find(
      (m) => m.role === "user" && m.parts[0]?.type === "text" &&
        m.parts[0].text === "second",
    );
    expect(promoted?.status).toBe("complete");
  });

  it("a message queued behind the cancelled one is not dropped — it dispatches next", () => {
    const { transport, state } = controllable();
    const { result } = renderHook(() => useChat({ config, transport }));

    act(() => result.current.send("first"));
    act(() => state.handlers!.onEvent({ type: "token", delta: "partial" }));
    // Second send while streaming → queued behind the active generation.
    act(() => result.current.send("second"));

    const sendsBefore = state.sends;
    act(() => result.current.cancel());

    // The queued "second" turn started a fresh generation (not silently dropped).
    expect(state.sends).toBe(sendsBefore + 1);
    const users = result.current.messages.filter((m) => m.role === "user");
    expect(users.map((m) => m.parts[0])).toEqual([
      { type: "text", text: "first" },
      { type: "text", text: "second" },
    ]);
    expect(result.current.status).toBe("streaming");
  });
});
