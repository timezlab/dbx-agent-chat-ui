import { type Conversation, ConversationSchema } from "@/entities";

import type { HistoryProvider } from "./provider";

/**
 * Remote history over a host-provided REST endpoint (providers.md):
 *  - `GET  {url}` → `200 { conversation: Conversation | null }`
 *  - `PUT  {url}` body `{ conversation }` → `2xx`
 *
 * Any non-2xx / network error / malformed body throws, so the failover wrapper in
 * `resolveHistory` can demote to local (D9). No bundled secret — auth (if any) is the
 * deployment wrapper's concern via same-origin cookies (`credentials: "include"`).
 */
export function createRemoteHistory(
  url: string,
  fetchImpl?: typeof fetch,
): HistoryProvider {
  const doFetch = fetchImpl ?? globalThis.fetch;

  return {
    async load(): Promise<Conversation | null> {
      const response = await doFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`History load failed (${response.status})`);
      }
      const body = (await response.json()) as { conversation?: unknown };
      if (body.conversation == null) return null;
      const result = ConversationSchema.safeParse(body.conversation);
      if (!result.success) {
        throw new Error("History load returned a malformed conversation");
      }
      return result.data;
    },
    async save(conversation: Conversation): Promise<void> {
      const response = await doFetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ conversation }),
      });
      if (!response.ok) {
        throw new Error(`History save failed (${response.status})`);
      }
    },
  };
}
