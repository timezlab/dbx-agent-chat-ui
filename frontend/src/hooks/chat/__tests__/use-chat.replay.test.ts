import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CapabilityConfig } from "@/entities";
import type { ChatStreamHandlers, ChatTransport } from "@/lib/chat/transport";
import { useChat } from "@/hooks/chat/use-chat";
import { resetSessionStore } from "@/store/session-store";

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

beforeEach(() => {
  resetSessionStore();
});

const smallRecording =
  [
    `data: ${JSON.stringify({
      type: "response.output_text.delta",
      delta: "Hello replay",
    })}`,
    `data: ${JSON.stringify({
      type: "response.output_item.done",
      item: { type: "message" },
    })}`,
  ].join("\n\n") + "\n\n";

const recordingWithQuestion =
  [
    `data: ${JSON.stringify({
      type: "replay.user_request",
      text: "What is the YTD report?",
    })}`,
    `data: ${JSON.stringify({
      type: "response.output_text.delta",
      delta: "Hello replay",
    })}`,
    `data: ${JSON.stringify({
      type: "response.output_item.done",
      item: { type: "message" },
    })}`,
  ].join("\n\n") + "\n\n";

const userText = (
  messages: { role: string; parts: { type: string; text?: string }[] }[],
) =>
  messages
    .filter((m) => m.role === "user")
    .flatMap((m) => m.parts)
    .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
    .join("");

const assistantText = (
  messages: { role: string; parts: { type: string; text?: string }[] }[],
) =>
  messages
    .filter((m) => m.role === "assistant")
    .flatMap((m) => m.parts)
    .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
    .join("");

describe("useChat — replay mode (US1)", () => {
  it("plays a recording as a labelled user + assistant turn, driving the reducer, without persisting", async () => {
    const onConversationSettled = vi.fn();
    const { transport } = controllable();
    const { result } = renderHook(() =>
      useChat({ config, transport, onConversationSettled }),
    );

    act(() => result.current.toggleReplayMode());
    expect(result.current.replayMode).toBe(true);

    // Zero delay keeps the test fast; upload source feeds a tiny recording.
    act(() => result.current.replaySetTiming({ textDelayMs: 0, toolDelayMs: 0 }));
    act(() =>
      result.current.replaySetSource({
        kind: "upload",
        fileName: "capture.txt",
        text: smallRecording,
      }),
    );
    act(() => result.current.replayPlay());

    await waitFor(() =>
      expect(
        result.current.messages.some(
          (m) => m.role === "assistant" && m.status === "complete",
        ),
      ).toBe(true),
    );

    const user = result.current.messages.find((m) => m.role === "user");
    expect(
      user?.parts.map((p) => (p.type === "text" ? p.text : "")).join(""),
    ).toContain("capture.txt");
    expect(assistantText(result.current.messages)).toContain("Hello replay");

    // FR-020 / SC-006 — replay is NEVER recorded (no settle notification).
    expect(onConversationSettled).not.toHaveBeenCalled();
    expect(result.current.replaySession.status).toBe("idle");
  });

  it("shows the embedded user question (not the filename) and types it in first (FR-028/FR-029)", async () => {
    const { transport } = controllable();
    const { result } = renderHook(() => useChat({ config, transport }));

    act(() => result.current.toggleReplayMode());
    // A small non-zero delay so the typing effect is observable before it commits.
    act(() => result.current.replaySetTiming({ textDelayMs: 1, toolDelayMs: 0 }));
    act(() =>
      result.current.replaySetSource({
        kind: "upload",
        fileName: "capture.txt",
        text: recordingWithQuestion,
      }),
    );
    act(() => result.current.replayPlay());

    // Typing phase: the composer override text fills in, no user turn committed yet.
    await waitFor(() =>
      expect(result.current.replayTypingText).not.toBeNull(),
    );

    await waitFor(() =>
      expect(
        result.current.messages.some(
          (m) => m.role === "assistant" && m.status === "complete",
        ),
      ).toBe(true),
    );

    // The user bubble is the embedded question, and typing has cleared.
    expect(userText(result.current.messages)).toBe("What is the YTD report?");
    expect(userText(result.current.messages)).not.toContain("capture.txt");
    expect(result.current.replayTypingText).toBeNull();
    expect(assistantText(result.current.messages)).toContain("Hello replay");
  });

  it("toggling replay mode off resets to a fresh, empty conversation", async () => {
    const onConversationSettled = vi.fn();
    const { transport } = controllable();
    const { result } = renderHook(() =>
      useChat({ config, transport, onConversationSettled }),
    );

    act(() => result.current.toggleReplayMode());
    act(() => result.current.replaySetTiming({ textDelayMs: 0, toolDelayMs: 0 }));
    act(() =>
      result.current.replaySetSource({
        kind: "upload",
        fileName: "capture.txt",
        text: smallRecording,
      }),
    );
    act(() => result.current.replayPlay());
    await waitFor(() =>
      expect(result.current.messages.length).toBeGreaterThan(0),
    );

    act(() => result.current.toggleReplayMode());
    expect(result.current.replayMode).toBe(false);
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.replaySession.status).toBe("idle");
    expect(onConversationSettled).not.toHaveBeenCalled();
  });
});
