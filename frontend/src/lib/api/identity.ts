import type { AxiosInstance } from "axios";

import {
  type CapabilityConfig,
  type Identity,
  IdentitySchema,
} from "@/entities";

import { ApiService } from "./base";

/**
 * Identity capability — the current user's identity for the sidebar chip (display-only;
 * never sent to the chat backend). `GET {meUrl}` → `Identity`. Unconfigured ⇒ null (no
 * request, chip hidden). A non-2xx / malformed body (notably a missing `email`) throws;
 * the hook swallows it to the same hidden-chip state.
 */
export class IdentityApiService extends ApiService {
  /** Declares its endpoint: `meUrl` from public config (unset ⇒ chip hidden). */
  constructor(config: CapabilityConfig, client?: AxiosInstance) {
    super(config.meUrl, client);
  }

  async me(): Promise<Identity | null> {
    if (!this.configured) return null;
    return this.request(IdentitySchema, { method: "GET" }, "IdentityApi.me");
  }
}
