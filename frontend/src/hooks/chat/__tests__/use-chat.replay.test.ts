import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CapabilityConfig } from "@/entities";
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

function makeHistory(): HistoryProvider {
  return {
    list: vi.fn(async () => []),
    load: vi.fn(async () => null),
    save: vi.fn(async () => {}),
  };
}

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

const assistantText = (messages: { role: string; parts: { type: string }[] }[]) =>
  messages
    .filter((m) => m.role === "assistant")
    .flatMap((m) => m.parts)
    .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
    .join("");

describe("useChat — replay mode (US1)", () => {
  it("plays a recording as a labelled user + assistant turn, driving the reducer, without persisting", async () => {
    const history = makeHistory();
    const { transport } = controllable();
    const { result } = renderHook(() => useChat({ config, transport, history }));

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

    // FR-020 / SC-006 — replay is NEVER persisted.
    expect(history.save).not.toHaveBeenCalled();
    expect(result.current.replaySession.status).toBe("idle");
  });

  it("toggling replay mode off resets to a fresh, empty conversation", async () => {
    const history = makeHistory();
    const { transport } = controllable();
    const { result } = renderHook(() => useChat({ config, transport, history }));

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
    expect(history.save).not.toHaveBeenCalled();
  });
});
