import {
  type Conversation,
  ConversationSchema,
  type ConversationSummary,
  ConversationSummarySchema,
} from "@/entities";

import type { HistoryProvider } from "./provider";

const ListResponseSchema = ConversationSummarySchema.array();

/** Join a list URL with a conversation id, tolerating a trailing slash on the base. */
function detailUrl(base: string, id: string): string {
  return `${base.replace(/\/+$/, "")}/${encodeURIComponent(id)}`;
}

/**
 * Remote history over a host-provided REST endpoint (providers.md). Read-only from the
 * UI — a configured backend owns writes:
 *  - `GET {url}`      → `200 { conversations: ConversationSummary[] }`  (sidebar list)
 *  - `GET {url}/{id}` → `200 { conversation: Conversation | null }`     (open one)
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

  const getJson = async (target: string): Promise<unknown> => {
    const response = await doFetch(target, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`History request failed (${response.status})`);
    }
    return response.json();
  };

  return {
    async list(): Promise<ConversationSummary[]> {
      const body = (await getJson(url)) as { conversations?: unknown };
      const result = ListResponseSchema.safeParse(body.conversations ?? []);
      if (!result.success) {
        throw new Error("History list returned a malformed payload");
      }
      // Newest-first, regardless of server ordering.
      return [...result.data].sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async load(id?: string): Promise<Conversation | null> {
      // No id ⇒ resolve the most recent from the list, then fetch it.
      if (!id) {
        const summaries = await this.list();
        if (summaries.length === 0) return null;
        return this.load(summaries[0].id);
      }
      const body = (await getJson(detailUrl(url, id))) as {
        conversation?: unknown;
      };
      if (body.conversation == null) return null;
      const result = ConversationSchema.safeParse(body.conversation);
      if (!result.success) {
        throw new Error("History load returned a malformed conversation");
      }
      return result.data;
    },
    async save(): Promise<void> {
      // The backend records conversations as they stream; the UI does not write history.
      // (The failover wrapper still keeps a local cache — see resolveHistory.)
    },
  };
}
