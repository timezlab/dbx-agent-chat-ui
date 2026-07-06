import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CapabilityConfig, Feedback } from "@/entities";
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

function settledAssistant() {
  const { transport, state } = controllable();
  const submitFeedback: (feedback: Feedback) => Promise<void> = vi.fn(
    async () => {},
  );
  const { result } = renderHook(() =>
    useChat({ config, transport, submitFeedback }),
  );
  act(() => result.current.send("hi"));
  act(() => state.handlers!.onEvent({ type: "token", delta: "hello" }));
  act(() => state.handlers!.onEvent({ type: "done" }));
  const assistantId = result.current.conversation.messages.find(
    (m) => m.role === "assistant",
  )!.id;
  return { result, submitFeedback, assistantId };
}

describe("useChat — submitFeedback (US3)", () => {
  it("stores the full feedback object (rating + comment) on the message", () => {
    const { result, submitFeedback, assistantId } = settledAssistant();

    act(() => {
      void result.current.submitFeedback({
        messageId: assistantId,
        rating: "up",
        comment: "nice",
      });
    });

    const target = result.current.conversation.messages.find(
      (m) => m.id === assistantId,
    )!;
    expect(target.feedback).toMatchObject({ rating: "up", comment: "nice" });
    expect(typeof target.feedback?.submittedAt).toBe("number");
    expect(submitFeedback).toHaveBeenCalledWith({
      messageId: assistantId,
      rating: "up",
      comment: "nice",
    });
  });

  it("keeps a prior comment when a later submit changes only the rating", () => {
    const { result, assistantId } = settledAssistant();

    act(() => {
      void result.current.submitFeedback({
        messageId: assistantId,
        rating: "up",
        comment: "keep me",
      });
    });
    act(() => {
      void result.current.submitFeedback({
        messageId: assistantId,
        rating: "down",
      });
    });

    const target = result.current.conversation.messages.find(
      (m) => m.id === assistantId,
    )!;
    expect(target.feedback).toMatchObject({ rating: "down", comment: "keep me" });
  });
});
