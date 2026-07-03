import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CapabilityConfig, Conversation } from "@/entities";
import type { HistoryProvider } from "@/lib/history/provider";
import type { ChatStreamHandlers, ChatTransport } from "@/lib/chat/transport";
import { useChat } from "@/hooks/chat/use-chat";

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
  activeId: null,
  queue: [],
  status: "idle",
};

describe("useChat — history persistence (US4)", () => {
  it("hydrates a pristine session from persisted history on startup", async () => {
    const history: HistoryProvider = {
      list: vi.fn(async () => [
        { id: "restored", title: "earlier", updatedAt: 1, messageCount: 1 },
      ]),
      load: vi.fn(async () => restored),
      save: vi.fn(async () => {}),
    };
    const { transport } = controllable();
    const { result } = renderHook(() =>
      useChat({ config, transport, history }),
    );

    await waitFor(() =>
      expect(result.current.messages).toHaveLength(1),
    );
    expect(result.current.messages[0].parts[0]).toEqual({
      type: "text",
      text: "earlier",
    });
  });

  it("saves the conversation on a terminal turn transition", async () => {
    const history: HistoryProvider = {
      list: vi.fn(async () => []),
      load: vi.fn(async () => null),
      save: vi.fn(async () => {}),
    };
    const { transport, state } = controllable();
    const { result } = renderHook(() =>
      useChat({ config, transport, history }),
    );

    act(() => result.current.send("hi"));
    act(() => state.handlers!.onEvent({ type: "token", delta: "hello" }));
    act(() => state.handlers!.onEvent({ type: "done" }));

    await waitFor(() => expect(history.save).toHaveBeenCalled());
    const saved = (history.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Conversation;
    expect(saved.status).toBe("idle");
    expect(saved.messages.some((m) => m.role === "assistant")).toBe(true);
  });

  it("newConversation clears state without persisting an empty session", async () => {
    const history: HistoryProvider = {
      list: vi.fn(async () => []),
      load: vi.fn(async () => null),
      save: vi.fn(async () => {}),
    };
    const { transport, state } = controllable();
    const { result } = renderHook(() =>
      useChat({ config, transport, history }),
    );

    act(() => result.current.send("hi"));
    act(() => state.handlers!.onEvent({ type: "done" }));
    expect(result.current.messages.length).toBeGreaterThan(0);
    const savesBefore = (history.save as ReturnType<typeof vi.fn>).mock.calls
      .length;

    act(() => result.current.newConversation());
    expect(result.current.messages).toHaveLength(0);
    // The fresh empty conversation is NOT saved (no ghost row) and existing saved
    // history is left untouched — no new save call beyond the terminal transition.
    expect(
      (history.save as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(savesBefore);
  });

  it("lists past conversations and opens one via selectConversation", async () => {
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
    const history: HistoryProvider = {
      list: vi.fn(async () => [
        { id: "restored", title: "earlier", updatedAt: 2, messageCount: 1 },
        { id: "other", title: "the other one", updatedAt: 1, messageCount: 1 },
      ]),
      load: vi.fn(async (id?: string) =>
        id === "other" ? other : restored,
      ),
      save: vi.fn(async () => {}),
    };
    const { transport } = controllable();
    const { result } = renderHook(() =>
      useChat({ config, transport, history }),
    );

    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    act(() => result.current.selectConversation("other"));
    await waitFor(() =>
      expect(result.current.conversation.id).toBe("other"),
    );
    expect(result.current.messages[0].parts[0]).toEqual({
      type: "text",
      text: "the other one",
    });
  });
});
