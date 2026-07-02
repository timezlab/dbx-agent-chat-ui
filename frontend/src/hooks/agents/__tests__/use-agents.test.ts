import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAgents } from "@/hooks/agents/use-agents";
import type { AgentsClient } from "@/lib/agents/client";

const agents = [
  { id: "a1", name: "Analyst" },
  { id: "a2", name: "Coder" },
];

describe("useAgents (US5)", () => {
  it("stays empty/unavailable when no agentsUrl is configured (client resolves to null)", () => {
    const { result } = renderHook(() => useAgents({ config: {} }));
    expect(result.current.agents).toEqual([]);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.available).toBe(false);
  });

  it("loads agents once and auto-selects the first one", async () => {
    const client: AgentsClient = { list: vi.fn(async () => agents) };
    const { result } = renderHook(() =>
      useAgents({ config: { agentsUrl: "https://a.example" }, client }),
    );

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.agents).toEqual(agents);
    expect(result.current.selectedId).toBe("a1");
    expect(client.list).toHaveBeenCalledOnce();
  });

  it("stays unavailable when list() resolves empty", async () => {
    const client: AgentsClient = { list: vi.fn(async () => []) };
    const { result } = renderHook(() =>
      useAgents({ config: { agentsUrl: "https://a.example" }, client }),
    );

    await waitFor(() => expect(client.list).toHaveBeenCalledOnce());
    expect(result.current.agents).toEqual([]);
    expect(result.current.available).toBe(false);
    expect(result.current.selectedId).toBeNull();
  });

  it("stays unavailable when list() rejects (selector hidden, FR-026)", async () => {
    const client: AgentsClient = {
      list: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const { result } = renderHook(() =>
      useAgents({ config: { agentsUrl: "https://a.example" }, client }),
    );

    await waitFor(() => expect(client.list).toHaveBeenCalledOnce());
    expect(result.current.available).toBe(false);
    expect(result.current.agents).toEqual([]);
  });

  it("setSelectedId switches selection among loaded agents", async () => {
    const client: AgentsClient = { list: vi.fn(async () => agents) };
    const { result } = renderHook(() =>
      useAgents({ config: { agentsUrl: "https://a.example" }, client }),
    );

    await waitFor(() => expect(result.current.selectedId).toBe("a1"));
    act(() => result.current.setSelectedId("a2"));
    expect(result.current.selectedId).toBe("a2");
  });

  it("setSelectedId ignores an id that isn't in the loaded list", async () => {
    const client: AgentsClient = { list: vi.fn(async () => agents) };
    const { result } = renderHook(() =>
      useAgents({ config: { agentsUrl: "https://a.example" }, client }),
    );

    await waitFor(() => expect(result.current.selectedId).toBe("a1"));
    act(() => result.current.setSelectedId("unknown"));
    expect(result.current.selectedId).toBe("a1");
  });
});
