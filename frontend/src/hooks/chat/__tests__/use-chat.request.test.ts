import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CapabilityConfig, ChatRequest } from "@/entities";
import type { ChatStreamHandlers, ChatTransport } from "@/lib/chat/transport";
import { useChat } from "@/hooks/chat/use-chat";

const config: CapabilityConfig = {
  chatEndpointUrl: "https://agent.example/invocations",
};

/**
 * A transport that records each request and hands back control to settle the in-flight
 * turn — so we can exercise both the direct send and the queue-drain path.
 */
function controllableTransport() {
  const calls: ChatRequest[] = [];
  let handlers: ChatStreamHandlers | null = null;
  const transport: ChatTransport = {
    send: (input, h) => {
      calls.push(input);
      handlers = h;
      return new AbortController();
    },
  };
  const finish = () => {
    act(() => {
      handlers?.onClose?.("done");
    });
  };
  return { transport, calls, finish };
}

describe("useChat — thin request: current turn only (004, FR-019..021)", () => {
  it("sends ONLY the current user turn, not accumulated history", async () => {
    const { transport, calls, finish } = controllableTransport();
    const { result } = renderHook(() => useChat({ config, transport }));

    act(() => result.current.send("first"));
    expect(calls[0].query).toBe("first");
    expect(calls[0].attachments).toBeUndefined();

    // Settle the first turn, then send a second: the backend owns the Checkpoint by
    // conversationId, so the request must NOT re-include the prior turn.
    finish();
    await waitFor(() => expect(result.current.status).toBe("idle"));

    act(() => result.current.send("second"));
    expect(calls[1].query).toBe("second");
    // conversationId is still carried so the backend can correlate the Checkpoint.
    expect(calls[1].conversationId).toBe(calls[0].conversationId);
  });

  it("drains a queued turn as a thin request too", () => {
    const { transport, calls, finish } = controllableTransport();
    const { result } = renderHook(() => useChat({ config, transport }));

    act(() => result.current.send("first")); // in-flight
    act(() => result.current.send("second")); // queues behind it
    expect(calls).toHaveLength(1);

    finish(); // terminal → drains the queue
    expect(calls).toHaveLength(2);
    expect(calls[1].query).toBe("second");
  });

  it("keeps attachments on the current turn", () => {
    const { transport, calls } = controllableTransport();
    const { result } = renderHook(() => useChat({ config, transport }));

    const attachment = {
      id: "a1",
      name: "cat.png",
      mimeType: "image/png",
      size: 3,
      dataUrl: "data:image/png;base64,eA==",
    };
    act(() => result.current.send("look", [attachment]));

    expect(calls[0].query).toBe("look");
    expect(calls[0].attachments).toEqual([attachment]);
  });
});
