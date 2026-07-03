import { IdentitySchema, type Identity } from "@/entities";
import type { IdentityClient } from "./client";

/**
 * Remote identity client (providers.md): `GET {url}` → `200 Identity`. A non-2xx,
 * network error, or a payload that doesn't match the contract (notably a missing
 * `email`) rejects, so the hook demotes to "no chip". No bundled secret — auth (if any)
 * is same-origin cookies via `credentials: "include"` (Principle II).
 */
export function createRemoteIdentity(
  url: string,
  fetchImpl?: typeof fetch,
): IdentityClient {
  const doFetch = fetchImpl ?? globalThis.fetch;
  return {
    async me(): Promise<Identity> {
      const response = await doFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Identity fetch failed (${response.status})`);
      }
      return IdentitySchema.parse(await response.json());
    },
  };
}
