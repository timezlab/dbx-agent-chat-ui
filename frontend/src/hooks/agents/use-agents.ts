"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Agent, CapabilityConfig } from "@/entities";
import { resolveAgents, type AgentsClient } from "@/lib/agents/client";

export interface UseAgentsOptions {
  /** Public capability config; used to resolve the agents client from `agentsUrl`. */
  config: CapabilityConfig;
  /** Agents client; defaults to `resolveAgents(config)`. Injectable for tests. */
  client?: AgentsClient | null;
}

export interface UseAgentsResult {
  /** Fetched agents (empty until loaded, or if none / the fetch failed). */
  agents: Agent[];
  /** Currently selected agent id, sent as `ChatRequest.agentId`. Null ⇒ none. */
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
 * Fetch the selectable agents once on mount (following the same load-once effect
 * pattern as history hydration in `useChat`) and hold the runtime selection. A null
 * client (no `agentsUrl`), a throwing `list()`, or an empty list all collapse to
 * `available: false` — the selector hides and chat uses the default endpoint with no
 * agent id (FR-024..FR-026, D11). The first agent is auto-selected so a configured
 * selector always sends a concrete `agentId`.
 */
export function useAgents(options: UseAgentsOptions): UseAgentsResult {
  const client = useMemo(
    () =>
      options.client !== undefined
        ? options.client
        : resolveAgents(options.config),
    [options.client, options.config],
  );

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelected] = useState<string | null>(null);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    if (!client) return;
    let cancelled = false;
    void client
      .list()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setAgents(list);
        setSelected(list[0].id); // default to the first so a request always has an id
      })
      .catch(() => {
        // Swallow: a failed list ⇒ no selector, default endpoint (FR-026).
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const setSelectedId = useCallback((id: string) => {
    // Ignore ids not in the list (stale option) — keep the current selection.
    setAgents((current) => {
      if (current.some((a) => a.id === id)) setSelected(id);
      return current;
    });
  }, []);

  return {
    agents,
    selectedId,
    setSelectedId,
    available: agents.length > 0,
  };
}

export default useAgents;
