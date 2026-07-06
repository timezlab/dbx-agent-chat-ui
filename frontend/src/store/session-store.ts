"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CapabilityConfig } from "@/entities";
import { resolveConfig } from "@/lib/config";

/** Stable, unique id. Mirrors `use-chat`'s default so ids are shaped the same. */
function genId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Math.random().toString(36).slice(2)}`
  );
}

/**
 * Client-only session state (the "local variables" the app carries at runtime):
 * the resolved public `config`, the active `conversationId`, and the selected agent.
 *
 * History DATA is never kept in the browser — a configured backend is the only store of
 * record (ADR `state-store-and-no-local-history.md`). What DOES persist to `localStorage`
 * is just the small session pointers: which conversation was open (`conversationId`) and
 * which agent was chosen (`selectedAgentId`). On reload those are restored and the
 * conversation is re-fetched from the backend by id — no cached turns, just a pointer.
 * `conversationId` starts `null` ("nothing opened yet" ⇒ empty screen). `config` is
 * env-derived every load, so it is deliberately NOT persisted.
 */
export interface SessionState {
  /** Resolved public capability config (env-derived; re-seeded when embedded). */
  config: CapabilityConfig;
  /** Id of the conversation currently on screen; null ⇒ nothing opened yet (empty). */
  conversationId: string | null;
  /** Selected agent id, sent on each chat request. Null ⇒ default routing. */
  selectedAgentId: string | null;

  /**
   * True once the persisted pointers have been read back from `localStorage` (after mount).
   * Starts `false` so the first client render matches the static-prerendered HTML — the
   * persisted `conversationId`/`selectedAgentId` are only applied AFTER hydration, avoiding
   * an SSR/CSR hydration mismatch. Consumers that branch on a persisted pointer (e.g. the
   * startup "re-open stored conversation" effect) must wait for this to flip true.
   */
  _hasHydrated: boolean;

  /** Replace the config (e.g. an embedder passes an explicit `config` prop). */
  setConfig: (config: CapabilityConfig) => void;
  /** Point the store at an existing conversation (opening one from history). */
  setConversationId: (id: string) => void;
  /** Mint a fresh conversation id and return it (New chat). */
  newConversationId: () => string;
  /** Choose an agent (or clear the selection with null). */
  selectAgent: (id: string | null) => void;
  /** Flipped by the persist rehydration callback (and tests) once pointers are loaded. */
  setHasHydrated: (v: boolean) => void;
}

/** SSR/build fallback — no `localStorage` during static prerender; persist is a no-op. */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      config: resolveConfig(),
      conversationId: null,
      selectedAgentId: null,
      _hasHydrated: false,

      setConfig: (config) => set({ config }),
      setConversationId: (id) => set({ conversationId: id }),
      newConversationId: () => {
        const id = genId();
        set({ conversationId: id });
        return id;
      },
      selectAgent: (id) => set({ selectedAgentId: id }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "dbx-agent-session",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage,
      ),
      // Persist only the session pointers — never `config` (env-derived each load) and
      // never `_hasHydrated` (a runtime lifecycle flag, meaningless to store).
      partialize: (state) => ({
        conversationId: state.conversationId,
        selectedAgentId: state.selectedAgentId,
      }),
      // Defer reading `localStorage` until we explicitly `rehydrate()` after mount (see
      // `Providers`). Without this, persist would rehydrate synchronously at module load
      // and the first client render would diverge from the prerendered HTML.
      skipHydration: true,
      // Fires when `rehydrate()` finishes — mark the store ready so gated consumers proceed.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

/**
 * Reset the singleton to a clean slate — for test isolation only (the store is a
 * module-level singleton shared across a test file's cases). Also clears any persisted
 * pointers so a test never inherits another test's `conversationId`/agent.
 */
export function resetSessionStore(
  config: CapabilityConfig = resolveConfig(),
): void {
  useSessionStore.persist?.clearStorage?.();
  useSessionStore.setState({
    config,
    conversationId: null,
    selectedAgentId: null,
    // Tests never mount `Providers`, so no `rehydrate()` runs — treat the reset store as
    // already hydrated so hydration-gated effects (startup re-open) execute under test.
    _hasHydrated: true,
  });
}
