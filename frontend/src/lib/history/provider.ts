import type { CapabilityConfig, Conversation } from "@/entities";

import { createLocalHistory } from "./local";
import { createRemoteHistory } from "./remote";

/** Persistence port: restore on startup, save on terminal turn transitions (D9). */
export interface HistoryProvider {
  /** Restore the persisted conversation on startup, or null if none. */
  load(): Promise<Conversation | null>;
  /** Persist the conversation (called on terminal turn transitions). */
  save(conversation: Conversation): Promise<void>;
}

/** Seams for tests — swap the concrete local/remote providers. */
export interface ResolveHistoryDeps {
  makeLocal?: () => HistoryProvider;
  makeRemote?: (url: string) => HistoryProvider;
}

/**
 * Resolve the history provider from public config (D8–D9): remote when `historyUrl`
 * is set (wrapped so a per-call remote failure demotes to local), else local. Local
 * itself degrades `localStorage → in-memory`. History is thus always available and
 * never crashes the session.
 */
export function resolveHistory(
  config: CapabilityConfig,
  deps: ResolveHistoryDeps = {},
): HistoryProvider {
  const makeLocal = deps.makeLocal ?? (() => createLocalHistory());
  const makeRemote =
    deps.makeRemote ?? ((url: string) => createRemoteHistory(url));

  const local = makeLocal();
  if (!config.historyUrl) return local;

  return withLocalFailover(makeRemote(config.historyUrl), local);
}

/** Wrap a remote provider so any thrown error per call delegates to local (FR-020). */
function withLocalFailover(
  remote: HistoryProvider,
  local: HistoryProvider,
): HistoryProvider {
  return {
    async load(): Promise<Conversation | null> {
      try {
        return await remote.load();
      } catch {
        return local.load();
      }
    },
    async save(conversation: Conversation): Promise<void> {
      try {
        await remote.save(conversation);
      } catch {
        await local.save(conversation);
      }
    },
  };
}
