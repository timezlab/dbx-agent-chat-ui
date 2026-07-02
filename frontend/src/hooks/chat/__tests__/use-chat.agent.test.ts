import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CapabilityConfig, ChatRequest } from "@/entities";
import type { ChatTransport } from "@/lib/chat/transport";
import { useChat } from "@/hooks/chat/use-chat";

const config: CapabilityConfig = {
  chatEndpointUrl: "https://agent.example/invocations",
};

/** A transport that never emits — enough to observe what `send()` was called with. */
function spyTransport() {
  const calls: ChatRequest[] = [];
  const transport: ChatTransport = {
    send: (input) => {
      calls.push(input);
      return new AbortController();
    },
  };
  return { transport, calls };
}

describe("useChat — agent selection rides on ChatRequest.agentId (US5)", () => {
  it("omits agentId when none is selected", () => {
    const { transport, calls } = spyTransport();
    const { result } = renderHook(() => useChat({ config, transport }));

    act(() => result.current.send("hi"));

    expect(calls[0]?.agentId).toBeUndefined();
  });

  it("includes the selected agentId on the request", () => {
    const { transport, calls } = spyTransport();
    const { result } = renderHook(() =>
      useChat({ config, transport, agentId: "agent-1" }),
    );

    act(() => result.current.send("hi"));

    expect(calls[0]?.agentId).toBe("agent-1");
  });

  it("picks up a changed agentId on the next send without recreating the transport", () => {
    const { transport, calls } = spyTransport();
    const { result, rerender } = renderHook(
      ({ agentId }: { agentId: string | null }) =>
        useChat({ config, transport, agentId }),
      { initialProps: { agentId: "agent-1" as string | null } },
    );

    rerender({ agentId: "agent-2" });
    act(() => result.current.send("hi"));

    expect(calls[0]?.agentId).toBe("agent-2");
  });
});
