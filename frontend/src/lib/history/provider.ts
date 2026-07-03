import type {
  CapabilityConfig,
  Conversation,
  ConversationSummary,
} from "@/entities";

import { createLocalHistory } from "./local";
import { createRemoteHistory } from "./remote";

/**
 * Persistence port (D9). Read side is multi-conversation: `list()` for the sidebar and
 * `load(id)` for a specific past conversation (or the most recent when `id` is omitted).
 * Writes stay local-only — a configured backend owns persistence (it records turns as
 * they stream), so the remote `save` is a no-op and only the localStorage fallback
 * actually writes. History is thus always available and never crashes the session.
 */
export interface HistoryProvider {
  /** Summaries for the sidebar list, newest-first. */
  list(): Promise<ConversationSummary[]>;
  /** Full conversation by id; `id` omitted ⇒ the most recent (or null if none). */
  load(id?: string): Promise<Conversation | null>;
  /** Persist a conversation (local cache; the remote defers to the backend). */
  save(conversation: Conversation): Promise<void>;
}

/** Seams for tests — swap the concrete local/remote providers. */
export interface ResolveHistoryDeps {
  makeLocal?: () => HistoryProvider;
  makeRemote?: (url: string) => HistoryProvider;
}

/**
 * Resolve the history provider from public config (D8–D9): remote when `historyUrl`
 * is set (wrapped so a per-call remote read failure demotes to local), else local.
 * Local itself degrades `localStorage → in-memory`.
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

/** Wrap a remote provider so any thrown read error per call delegates to local. */
function withLocalFailover(
  remote: HistoryProvider,
  local: HistoryProvider,
): HistoryProvider {
  return {
    async list(): Promise<ConversationSummary[]> {
      try {
        return await remote.list();
      } catch {
        return local.list();
      }
    },
    async load(id?: string): Promise<Conversation | null> {
      try {
        return await remote.load(id);
      } catch {
        return local.load(id);
      }
    },
    async save(conversation: Conversation): Promise<void> {
      // Keep a local cache even when a backend is configured, so a failed backend read
      // on the next reload still restores what this client last saw. The backend owns
      // authoritative persistence (remote.save is a no-op).
      await local.save(conversation);
    },
  };
}
