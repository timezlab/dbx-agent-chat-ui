import { z } from "zod";

import { AgentSchema, type Agent } from "@/entities";
import type { AgentsClient } from "./client";

/** Response contract (providers.md): `GET {agentsUrl}` → `200 { agents: Agent[] }`. */
const AgentsResponseSchema = z.object({ agents: z.array(AgentSchema) });

/**
 * Remote agents client (providers.md): `GET {url}` → `200 { agents: Agent[] }`. A
 * non-2xx, network error, or a payload that doesn't match the contract rejects, so the
 * hook can demote to "no selector" (FR-026). No bundled secret — auth (if any) is
 * same-origin cookies via `credentials: "include"` (Principle II).
 */
export function createRemoteAgents(
  url: string,
  fetchImpl?: typeof fetch,
): AgentsClient {
  const doFetch = fetchImpl ?? globalThis.fetch;
  return {
    async list(): Promise<Agent[]> {
      const response = await doFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Agents list failed (${response.status})`);
      }
      return AgentsResponseSchema.parse(await response.json()).agents;
    },
  };
}
