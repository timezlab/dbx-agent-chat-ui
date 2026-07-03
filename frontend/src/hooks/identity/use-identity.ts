"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CapabilityConfig, Identity } from "@/entities";
import { resolveIdentity, type IdentityClient } from "@/lib/identity/client";

export interface UseIdentityOptions {
  /** Public capability config; used to resolve the identity client from `meUrl`. */
  config: CapabilityConfig;
  /** Identity client; defaults to `resolveIdentity(config)`. Injectable for tests. */
  client?: IdentityClient | null;
}

export interface UseIdentityResult {
  /** The fetched identity, or null until loaded / if unavailable. */
  identity: Identity | null;
  /**
   * Whether the identity chip should render. False when no `meUrl` is configured, the
   * fetch failed, or the payload lacked an email — the caller then hides the chip.
   */
  available: boolean;
}

/**
 * Fetch the current user's identity once on mount (same load-once effect pattern as
 * `useAgents`) and hold it for the sidebar chip. A null client (no `meUrl`) or a
 * throwing `me()` collapses to `available: false` — the chip hides. Display-only; the
 * identity is never sent to the chat backend.
 */
export function useIdentity(options: UseIdentityOptions): UseIdentityResult {
  const client = useMemo(
    () =>
      options.client !== undefined
        ? options.client
        : resolveIdentity(options.config),
    [options.client, options.config],
  );

  const [identity, setIdentity] = useState<Identity | null>(null);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    if (!client) return;
    let cancelled = false;
    void client
      .me()
      .then((me) => {
        if (cancelled) return;
        setIdentity(me);
      })
      .catch(() => {
        // Swallow: a failed fetch ⇒ no chip (mirrors useAgents demotion).
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return {
    identity,
    available: identity !== null,
  };
}

export default useIdentity;
