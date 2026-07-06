import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CapabilityConfig } from "@/entities";
import type {
  ChatRequest,
  ChatStreamHandlers,
  ChatTransport,
} from "@/lib/chat/transport";
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

  it("dispatched history for a queued turn excludes later still-queued turns (T071 leak fix)", () => {
    const inputs: ChatRequest[] = [];
    const state = { handlers: null as ChatStreamHandlers | null };
    const transport: ChatTransport = {
      send: (input, handlers) => {
        inputs.push(input);
        state.handlers = handlers;
        return new AbortController();
      },
    };
    const { result } = renderHook(() => useChat({ config, transport }));

    // "first" dispatches; while it streams, "A" then "B" are both queued.
    act(() => result.current.send("first"));
    act(() => state.handlers!.onEvent({ type: "token", delta: "reply-1" }));
    act(() => result.current.send("A"));
    act(() => result.current.send("B"));

    // First generation closes → "A" dispatches. Its history is [first, reply-1, A] —
    // "B" (still queued) must NOT leak into it.
    act(() => {
      state.handlers!.onEvent({ type: "done" });
      state.handlers!.onClose?.("done");
    });

    expect(inputs).toHaveLength(2);
    const dispatchA = inputs[1].messages;
    expect(dispatchA.map((m) => m.content)).toEqual(["first", "reply-1", "A"]);
    expect(dispatchA.some((m) => m.content === "B")).toBe(false);
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

  it("New chat while a turn is queued discards it — no phantom send to the backend", () => {
    const { transport, state } = controllable();
    const { result } = renderHook(() => useChat({ config, transport }));

    act(() => result.current.send("first"));
    act(() => state.handlers!.onEvent({ type: "token", delta: "partial" }));
    // Queue a turn behind the active generation, then leave via New chat.
    act(() => result.current.send("second"));

    const sendsBefore = state.sends;
    act(() => result.current.newConversation());

    // Leaving the conversation must NOT dispatch the queued turn (teardown, not cancel).
    expect(state.sends).toBe(sendsBefore);
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.status).toBe("idle");
  });

  it("Selecting another conversation while a turn is queued does not send it", () => {
    const { transport, state } = controllable();
    const restored = {
      id: "conv-old",
      messages: [],
      activeId: null,
      queue: [],
      status: "idle" as const,
    };
    const { result } = renderHook(() =>
      useChat({ config, transport, loadHistory: async () => restored }),
    );

    act(() => result.current.send("first"));
    act(() => state.handlers!.onEvent({ type: "token", delta: "partial" }));
    act(() => result.current.send("second"));

    const sendsBefore = state.sends;
    act(() => result.current.selectConversation("conv-old"));

    expect(state.sends).toBe(sendsBefore);
  });
});
