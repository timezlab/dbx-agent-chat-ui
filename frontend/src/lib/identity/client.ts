import type { CapabilityConfig, Identity } from "@/entities";

import { createRemoteIdentity } from "./remote";

/**
 * Identity port (providers.md): fetch the current user's identity for the sidebar chip.
 * Resolved from config — a real client when `meUrl` is set, else `null` (chip hidden,
 * no identity requested). Display-only; the UI never sends identity to the chat backend.
 */
export interface IdentityClient {
  me(): Promise<Identity>;
}

/** Seams for tests — swap the concrete remote client. */
export interface ResolveIdentityDeps {
  makeRemote?: (url: string) => IdentityClient;
}

/**
 * Resolve the identity client from public config: a remote client when `meUrl` is set,
 * else `null`. A null client (or a `me()` that throws / returns no email) means the
 * identity chip is hidden — mirrors how a null agents client hides the selector.
 */
export function resolveIdentity(
  config: CapabilityConfig,
  deps: ResolveIdentityDeps = {},
): IdentityClient | null {
  if (!config.meUrl) return null;
  const makeRemote =
    deps.makeRemote ?? ((url: string) => createRemoteIdentity(url));
  return makeRemote(config.meUrl);
}
