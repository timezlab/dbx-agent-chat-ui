import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CapabilityConfig } from "@/entities";
import type { ChatTransport } from "@/lib/chat/transport";
import { useChat } from "@/hooks/chat/use-chat";

const baseConfig: CapabilityConfig = {
  chatEndpointUrl: "https://agent.example/invocations",
};

/** A transport that never emits — enough to observe send() behavior. */
const inertTransport: ChatTransport = {
  send: () => new AbortController(),
};

describe("useChat — transport config guard (T055)", () => {
  it("has no config error when the chat endpoint is configured", () => {
    const { result } = renderHook(() =>
      useChat({ config: baseConfig, transport: inertTransport }),
    );
    expect(result.current.configError).toBeNull();
  });

  it("surfaces a readable notice when the chat endpoint is unset", () => {
    const config: CapabilityConfig = {
      // chatEndpointUrl intentionally unset — nothing can stream (FR-011a).
    };
    const { result } = renderHook(() =>
      useChat({ config, transport: inertTransport }),
    );
    expect(result.current.configError).toBeTruthy();
    expect(typeof result.current.configError).toBe("string");
  });

  it("does not crash and shows an inline error when the transport throws on send", () => {
    const throwing: ChatTransport = {
      send: () => {
        throw new Error("Chat endpoint is not configured.");
      },
    };
    const { result } = renderHook(() =>
      useChat({ config: baseConfig, transport: throwing }),
    );

    expect(() => {
      act(() => {
        result.current.send("hello");
      });
    }).not.toThrow();

    expect(result.current.configError).toBeTruthy();
  });

  it("appends an optimistic user message immediately on send", () => {
    const now = vi.fn(() => 42);
    let n = 0;
    const generateId = () => `id-${n++}`;
    const { result } = renderHook(() =>
      useChat({ config: baseConfig, transport: inertTransport, now, generateId }),
    );

    act(() => {
      result.current.send("hi there");
    });

    const user = result.current.messages.find((m) => m.role === "user");
    expect(user?.parts).toEqual([{ type: "text", text: "hi there" }]);
    expect(user?.status).toBe("complete");
  });

  it("ignores blank input (no message, no request)", () => {
    const send = vi.fn(() => new AbortController());
    const { result } = renderHook(() =>
      useChat({ config: baseConfig, transport: { send } }),
    );
    act(() => {
      result.current.send("   ");
    });
    expect(result.current.messages).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });
});
