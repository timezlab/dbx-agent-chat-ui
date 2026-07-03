import { z } from "zod";

import {
  type Conversation,
  ConversationSchema,
  type ConversationSummary,
} from "@/entities";

import type { HistoryProvider } from "./provider";
import { summarizeConversation } from "./summary";

/** Minimal `localStorage`-shaped surface (injectable for tests). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Bumped from the old single-conversation key (`:conversation`) — the store now holds
// a map of conversations by id, so a stale singular payload is simply ignored.
const DEFAULT_KEY = "dbx-agent-chat-ui:conversations";

export interface LocalHistoryOptions {
  key?: string;
  /** Defaults to `globalThis.localStorage`; falls back to in-memory if unavailable. */
  storage?: StorageLike;
}

/** On-disk shape: conversations keyed by id (order derived from `updatedAt`). */
const StoreSchema = z.record(z.string(), ConversationSchema);
type Store = Record<string, Conversation>;

/**
 * `localStorage`-backed multi-conversation history (FR-018..FR-020). Stores every
 * conversation keyed by id; `list()` derives sidebar summaries and `load(id)` returns
 * one (or the most recent when `id` is omitted). When storage is unavailable or throws
 * (private mode / disabled, FR-023) it degrades to an in-memory map, so persistence
 * silently no-ops across reloads rather than crashing the session. Corrupt or
 * schema-invalid data restores as an empty store.
 */
export function createLocalHistory(
  options: LocalHistoryOptions = {},
): HistoryProvider {
  const key = options.key ?? DEFAULT_KEY;
  const memory = new Map<string, string>();
  const storage = options.storage ?? safeDefaultStorage() ?? memoryStorage(memory);

  const readRaw = (): string | null => {
    try {
      return storage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  };

  const writeRaw = (value: string): void => {
    try {
      storage.setItem(key, value);
    } catch {
      memory.set(key, value); // degrade to in-memory
    }
  };

  const readStore = (): Store => {
    const raw = readRaw();
    if (!raw) return {};
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {}; // corrupt JSON → empty store
    }
    const result = StoreSchema.safeParse(parsed);
    return result.success ? result.data : {};
  };

  /** All conversations, newest-first by last-turn time. */
  const orderedConversations = (): Conversation[] =>
    Object.values(readStore()).sort(
      (a, b) => lastTurnAt(b) - lastTurnAt(a),
    );

  return {
    async list(): Promise<ConversationSummary[]> {
      return orderedConversations().map(summarizeConversation);
    },
    async load(id?: string): Promise<Conversation | null> {
      const conversations = orderedConversations();
      if (id) return conversations.find((c) => c.id === id) ?? null;
      return conversations[0] ?? null; // most recent
    },
    async save(conversation: Conversation): Promise<void> {
      // Don't persist an empty session — a brand-new "New chat" shouldn't create a
      // ghost row in the sidebar list before the user has said anything.
      if (conversation.messages.length === 0) return;
      const store = readStore();
      store[conversation.id] = stripAttachmentData(conversation);
      writeRaw(JSON.stringify(store));
    },
  };
}

/** Last turn's `createdAt` (0 for an empty conversation) — the sort/`updatedAt` key. */
function lastTurnAt(conversation: Conversation): number {
  const last = conversation.messages[conversation.messages.length - 1];
  return last?.createdAt ?? 0;
}

/**
 * Attachments are session-only (T071): drop each `dataUrl` before writing to
 * `localStorage` so base64 file bytes never sit in the browser's persistent storage
 * (quota risk) or survive a reload. Chips still render from name/size/mimeType after
 * restore — only the raw bytes are gone.
 *
 * `queue` is a transient send buffer, never persisted: it is empty whenever a turn
 * settles (the point where `save` fires), and its items carry their own attachment
 * bytes, so we drop it to `[]` outright rather than rely on that invariant holding.
 */
function stripAttachmentData(conversation: Conversation): Conversation {
  return {
    ...conversation,
    queue: [],
    messages: conversation.messages.map((m) =>
      m.attachments.length === 0
        ? m
        : {
            ...m,
            attachments: m.attachments.map((a) => ({ ...a, dataUrl: "" })),
          },
    ),
  };
}

/** The real `localStorage` if reachable, else undefined (triggers in-memory degrade). */
function safeDefaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined; // accessing localStorage can itself throw (blocked cookies)
  }
}

/** A pure in-memory `StorageLike` over a backing map (no persistence across reloads). */
function memoryStorage(memory: Map<string, string>): StorageLike {
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => {
      memory.set(k, v);
    },
    removeItem: (k) => {
      memory.delete(k);
    },
  };
}
