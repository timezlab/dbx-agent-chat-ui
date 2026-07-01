import type { Agent, CapabilityConfig } from "@/entities";

import { createRemoteAgents } from "./remote";

/**
 * Agents listing port (providers.md): fetch the selectable agents for the runtime
 * selector. Resolved from config — a real client when `agentsUrl` is set, else `null`
 * (no selector, default endpoint, no `agentId` on requests — FR-024..FR-026, D11).
 */
export interface AgentsClient {
  list(): Promise<Agent[]>;
}

/** Seams for tests — swap the concrete remote client. */
export interface ResolveAgentsDeps {
  makeRemote?: (url: string) => AgentsClient;
}

/**
 * Resolve the agents client from public config (D11): a remote client when `agentsUrl`
 * is set, else `null`. A null client (or a `list()` that throws / returns empty) means
 * the selector is hidden and chat uses the default endpoint with no `agentId`.
 */
export function resolveAgents(
  config: CapabilityConfig,
  deps: ResolveAgentsDeps = {},
): AgentsClient | null {
  if (!config.agentsUrl) return null;
  const makeRemote =
    deps.makeRemote ?? ((url: string) => createRemoteAgents(url));
  return makeRemote(config.agentsUrl);
}
