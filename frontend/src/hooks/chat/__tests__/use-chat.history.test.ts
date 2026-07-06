import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CapabilityConfig, ChatSession, Conversation } from "@/entities";
import type { ChatStreamHandlers, ChatTransport } from "@/lib/chat/transport";
import { useChat } from "@/hooks/chat/use-chat";
import { resetSessionStore, useSessionStore } from "@/store/session-store";

const config: CapabilityConfig = {
  chatEndpointUrl: "https://agent.example/invocations",
};

function controllable() {
  const state = { handlers: null as ChatStreamHandlers | null };
  const transport: ChatTransport = {
    send: (_input, handlers) => {
      state.handlers = handlers;
      return new AbortController();
    },
  };
  return { transport, state };
}

const restored: Conversation = {
  id: "restored",
  messages: [
    {
      id: "m1",
      role: "user",
      parts: [{ type: "text", text: "earlier" }],
      attachments: [],
      status: "complete",
      error: null,
      feedback: null,
      createdAt: 1,
    },
  ],
};

beforeEach(() => {
  resetSessionStore();
});

describe("useChat — history (US1, backend-only, no save)", () => {
  it("hydrates a pristine session from the stored conversation id on startup", async () => {
    // The store points at a previously-opened conversation (persisted pointer).
    useSessionStore.getState().setConversationId("restored");
    const loadHistory = vi.fn(async (id: string) =>
      id === "restored" ? restored : null,
    );
    const { transport } = controllable();
    const { result } = renderHook(() =>
      useChat({ config, transport, loadHistory }),
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(loadHistory).toHaveBeenCalledWith("restored");
    expect(result.current.messages[0].parts[0]).toEqual({
      type: "text",
      text: "earlier",
    });
  });

  it("shows an empty screen (no load) when nothing was opened before", async () => {
    // Fresh store ⇒ conversationId is null ⇒ we must NOT auto-open the most recent.
    const loadHistory = vi.fn(async () => restored);
    const { transport } = controllable();
    const { result } = renderHook(() =>
      useChat({ config, transport, loadHistory }),
    );

    // Give any startup effect a tick — it must not fire a load.
    await Promise.resolve();
    expect(loadHistory).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it("notifies onConversationSettled and publishes the id on a terminal turn", async () => {
    const onConversationSettled = vi.fn();
    const { transport, state } = controllable();
    const { result } = renderHook(() =>
      useChat({ config, transport, onConversationSettled }),
    );

    act(() => result.current.send("hi"));
    act(() => state.handlers!.onEvent({ type: "token", delta: "hello" }));
    act(() => state.handlers!.onEvent({ type: "done" }));

    await waitFor(() => expect(onConversationSettled).toHaveBeenCalled());
    // The settled conversation is the runtime session (status is a ChatSession field).
    const settled = onConversationSettled.mock.calls[0][0] as ChatSession;
    expect(settled.status).toBe("idle");
    expect(settled.messages.some((m) => m.role === "assistant")).toBe(true);
    // The store pointer now tracks the settled conversation (persisted).
    expect(useSessionStore.getState().conversationId).toBe(settled.id);
  });

  it("newConversation clears state and points the store at a fresh id", async () => {
    const onConversationSettled = vi.fn();
    const { transport, state } = controllable();
    const { result } = renderHook(() =>
      useChat({ config, transport, onConversationSettled }),
    );

    act(() => result.current.send("hi"));
    act(() => state.handlers!.onEvent({ type: "done" }));
    await waitFor(() => expect(onConversationSettled).toHaveBeenCalled());
    const settledId = useSessionStore.getState().conversationId;

    act(() => result.current.newConversation());
    expect(result.current.messages).toHaveLength(0);
    // A fresh, empty session — the store points at a NEW id, not the settled one.
    const freshId = useSessionStore.getState().conversationId;
    expect(freshId).not.toBe(settledId);
    expect(result.current.conversation.id).toBe(freshId);
  });

  it("opens a past conversation via selectConversation and publishes the pointer", async () => {
    const other: Conversation = {
      ...restored,
      id: "other",
      messages: [
        {
          ...restored.messages[0],
          id: "o1",
          parts: [{ type: "text", text: "the other one" }],
        },
      ],
    };
    const loadHistory = vi.fn(async (id: string) =>
      id === "other" ? other : restored,
    );
    const { transport } = controllable();
    const { result } = renderHook(() =>
      useChat({ config, transport, loadHistory }),
    );

    act(() => result.current.selectConversation("other"));
    await waitFor(() => expect(result.current.conversation.id).toBe("other"));
    expect(useSessionStore.getState().conversationId).toBe("other");
    expect(result.current.messages[0].parts[0]).toEqual({
      type: "text",
      text: "the other one",
    });
  });
});
