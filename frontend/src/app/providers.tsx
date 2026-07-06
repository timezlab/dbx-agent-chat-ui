"use client";

import * as React from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { useSessionStore } from "@/store/session-store";

/**
 * Client-only TanStack Query provider. A static-export SPA has no server prefetch /
 * hydration, so one module-singleton `QueryClient` backs the whole app (history
 * pagination lives here). Sensible defaults: a short `staleTime` and no refetch on window
 * focus, so the sidebar list doesn't re-fetch every time the tab regains focus.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  // The session store persists with `skipHydration`, so read the persisted pointers back
  // AFTER mount — this keeps the first client render identical to the prerendered HTML and
  // then flips `_hasHydrated`, unblocking the startup "re-open stored conversation" effect.
  React.useEffect(() => {
    void useSessionStore.persist.rehydrate();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export default Providers;
