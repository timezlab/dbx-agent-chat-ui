import type { AxiosInstance } from "axios";

import {
  AgentListResponseSchema,
  type Agent,
  type CapabilityConfig,
} from "@/entities";

import { ApiService } from "./base";

/**
 * Agents capability — the selectable agents for the runtime selector.
 * `GET {agentsUrl}` → `{ agents: Agent[] }`. Unconfigured ⇒ `[]` (no request), which the
 * hook reads as "no selector" (default endpoint, no `agentId` on requests). A non-2xx /
 * malformed body throws; the hook swallows it to the same empty state.
 */
export class AgentsApiService extends ApiService {
  /** Declares its endpoint: `agentsUrl` from public config (unset ⇒ no selector). */
  constructor(config: CapabilityConfig, client?: AxiosInstance) {
    super(config.agentsUrl, client);
  }

  async list(): Promise<Agent[]> {
    if (!this.configured) return [];
    const body = await this.request(
      AgentListResponseSchema,
      { method: "GET" },
      "AgentsApi.list",
    );
    return body.agents;
  }
}
