"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Agent, CapabilityConfig } from "@/entities";
import { AgentsApiService } from "@/lib/api/agents";
import { useSessionStore } from "@/store/session-store";

export interface UseAgentsOptions {
  /** Public capability config; used to build the agents service from `agentsUrl`. */
  config: CapabilityConfig;
  /** Agents service; defaults to `new AgentsApiService(config)`. Injectable for tests. */
  service?: Pick<AgentsApiService, "list">;
}

export interface UseAgentsResult {
  /** Fetched agents (empty until loaded, or if none / the fetch failed). */
  agents: Agent[];
  /** Currently selected agent id (from the session store). Null ⇒ none. */
  selectedId: string | null;
  /** Choose an agent (must be one of `agents`). */
  setSelectedId: (id: string) => void;
  /**
   * Whether the selector should render. False when no agents URL is configured, the
   * fetch failed, or the list is empty — the caller then hides the selector and sends
   * no `agentId` (FR-026).
   */
  available: boolean;
}

/**
 * Fetch the selectable agents once on mount and hold the runtime selection in the session
 * store (persisted, so a reload keeps the chosen agent). An unconfigured service (no
 * `agentsUrl`), a throwing `list()`, or an empty list all collapse to `available: false`
 * — the selector hides and chat uses the default endpoint with no agent id (FR-024..
 * FR-026, D11). A valid persisted selection is kept; otherwise the first agent is
 * auto-selected so a configured selector always sends a concrete `agentId`.
 */
export function useAgents(options: UseAgentsOptions): UseAgentsResult {
  const service = useMemo(
    () => options.service ?? new AgentsApiService(options.config),
    [options.service, options.config],
  );

  const [agents, setAgents] = useState<Agent[]>([]);
  const selectedId = useSessionStore((s) => s.selectedAgentId);
  const selectAgent = useSessionStore((s) => s.selectAgent);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;
    void service
      .list()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setAgents(list);
        // Keep a valid persisted selection; otherwise default to the first so a
        // configured selector always sends a concrete id.
        const current = useSessionStore.getState().selectedAgentId;
        if (!current || !list.some((a) => a.id === current)) {
          selectAgent(list[0].id);
        }
      })
      .catch(() => {
        // Swallow: a failed list ⇒ no selector, default endpoint (FR-026).
      });
    return () => {
      cancelled = true;
    };
  }, [service, selectAgent]);

  const setSelectedId = useCallback(
    (id: string) => {
      // Ignore ids not in the list (stale option) — keep the current selection.
      setAgents((current) => {
        if (current.some((a) => a.id === id)) selectAgent(id);
        return current;
      });
    },
    [selectAgent],
  );

  return {
    agents,
    selectedId,
    setSelectedId,
    available: agents.length > 0,
  };
}

export default useAgents;
