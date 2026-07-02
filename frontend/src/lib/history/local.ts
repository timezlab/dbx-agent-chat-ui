import { type Conversation, ConversationSchema } from "@/entities";

import type { HistoryProvider } from "./provider";

/** Minimal `localStorage`-shaped surface (injectable for tests). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const DEFAULT_KEY = "dbx-agent-chat-ui:conversation";

export interface LocalHistoryOptions {
  key?: string;
  /** Defaults to `globalThis.localStorage`; falls back to in-memory if unavailable. */
  storage?: StorageLike;
}

/**
 * `localStorage`-backed history (FR-018..FR-020). When storage is unavailable or
 * throws (private mode / disabled, FR-023) it degrades to an in-memory map, so
 * persistence silently no-ops across reloads rather than crashing the session.
 * Corrupt or schema-invalid data restores as a clean session (`load → null`).
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

  return {
    async load(): Promise<Conversation | null> {
      const raw = readRaw();
      if (!raw) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null; // corrupt JSON → clean session
      }
      const result = ConversationSchema.safeParse(parsed);
      return result.success ? result.data : null;
    },
    async save(conversation: Conversation): Promise<void> {
      writeRaw(JSON.stringify(stripAttachmentData(conversation)));
    },
  };
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
