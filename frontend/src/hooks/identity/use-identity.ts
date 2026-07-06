"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CapabilityConfig, Identity } from "@/entities";
import { IdentityApiService } from "@/lib/api/identity";

export interface UseIdentityOptions {
  /** Public capability config; used to build the identity service from `meUrl`. */
  config: CapabilityConfig;
  /** Identity service; defaults to `new IdentityApiService(config)`. Injectable for tests. */
  service?: Pick<IdentityApiService, "me">;
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
 * Fetch the current user's identity once on mount and hold it for the sidebar chip. An
 * unconfigured service (no `meUrl`) resolves to null and a throwing `me()` is swallowed
 * — either way `available: false` and the chip hides. Display-only; the identity is never
 * sent to the chat backend.
 */
export function useIdentity(options: UseIdentityOptions): UseIdentityResult {
  const service = useMemo(
    () => options.service ?? new IdentityApiService(options.config),
    [options.service, options.config],
  );

  const [identity, setIdentity] = useState<Identity | null>(null);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;
    void service
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
  }, [service]);

  return {
    identity,
    available: identity !== null,
  };
}

export default useIdentity;
