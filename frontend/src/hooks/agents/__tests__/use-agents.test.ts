import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Agent } from "@/entities";
import { useAgents } from "@/hooks/agents/use-agents";
import { resetSessionStore, useSessionStore } from "@/store/session-store";

const agents: Agent[] = [
  { id: "a1", name: "Analyst" },
  { id: "a2", name: "Coder" },
];

type AgentsService = { list: () => Promise<Agent[]> };

beforeEach(() => {
  // Selection lives in the (persisted) session store singleton — reset between cases.
  resetSessionStore();
});

describe("useAgents (US5)", () => {
  it("stays empty/unavailable when no agentsUrl is configured", () => {
    const { result } = renderHook(() => useAgents({ config: {} }));
    expect(result.current.agents).toEqual([]);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.available).toBe(false);
  });

  it("loads agents once and auto-selects the first one", async () => {
    const service: AgentsService = { list: vi.fn(async () => agents) };
    const { result } = renderHook(() =>
      useAgents({ config: { agentsUrl: "https://a.example" }, service }),
    );

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.agents).toEqual(agents);
    expect(result.current.selectedId).toBe("a1");
    expect(service.list).toHaveBeenCalledOnce();
  });

  it("keeps a valid persisted selection instead of defaulting to the first", async () => {
    // A previously-chosen agent already sits in the (persisted) store.
    useSessionStore.getState().selectAgent("a2");
    const service: AgentsService = { list: vi.fn(async () => agents) };
    const { result } = renderHook(() =>
      useAgents({ config: { agentsUrl: "https://a.example" }, service }),
    );
    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.selectedId).toBe("a2");
  });

  it("stays unavailable when list() resolves empty", async () => {
    const service: AgentsService = { list: vi.fn(async () => []) };
    const { result } = renderHook(() =>
      useAgents({ config: { agentsUrl: "https://a.example" }, service }),
    );

    await waitFor(() => expect(service.list).toHaveBeenCalledOnce());
    expect(result.current.agents).toEqual([]);
    expect(result.current.available).toBe(false);
    expect(result.current.selectedId).toBeNull();
  });

  it("stays unavailable when list() rejects (selector hidden, FR-026)", async () => {
    const service: AgentsService = {
      list: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const { result } = renderHook(() =>
      useAgents({ config: { agentsUrl: "https://a.example" }, service }),
    );

    await waitFor(() => expect(service.list).toHaveBeenCalledOnce());
    expect(result.current.available).toBe(false);
    expect(result.current.agents).toEqual([]);
  });

  it("setSelectedId switches selection among loaded agents", async () => {
    const service: AgentsService = { list: vi.fn(async () => agents) };
    const { result } = renderHook(() =>
      useAgents({ config: { agentsUrl: "https://a.example" }, service }),
    );

    await waitFor(() => expect(result.current.selectedId).toBe("a1"));
    act(() => result.current.setSelectedId("a2"));
    expect(result.current.selectedId).toBe("a2");
  });

  it("setSelectedId ignores an id that isn't in the loaded list", async () => {
    const service: AgentsService = { list: vi.fn(async () => agents) };
    const { result } = renderHook(() =>
      useAgents({ config: { agentsUrl: "https://a.example" }, service }),
    );

    await waitFor(() => expect(result.current.selectedId).toBe("a1"));
    act(() => result.current.setSelectedId("unknown"));
    expect(result.current.selectedId).toBe("a1");
  });
});
