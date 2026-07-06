import type { AxiosInstance } from "axios";

import {
  type CapabilityConfig,
  type Conversation,
  ConversationPageSchema,
  ConversationSchema,
  type ConversationSummary,
} from "@/entities";

import { ApiService } from "./base";

/**
 * History capability — read-only, backend-owned, paginated.
 *
 * `list({ page, perPage })` feeds the sidebar's infinite scroll one page at a time;
 * `load(id)` opens a specific past conversation (id is REQUIRED — no id, no load). There
 * is NO `save` and NO client persistence: a configured backend records turns as they
 * stream, so when no `historyUrl` is set (or a read fails) history is simply empty — the
 * browser keeps nothing in `localStorage` (ADR `state-store-and-no-local-history.md`).
 *
 * The wire shapes are entities (`ConversationPageSchema` / `ConversationSchema` in
 * `@/entities`); this file only issues the requests and parses with them — no `as { … }`
 * casts, no transform (the declared schema IS the response contract).
 */

/** Default page size for the sidebar list (page-by-page infinite scroll). */
export const DEFAULT_PER_PAGE = 20;

export interface HistoryListParams {
  page: number;
  perPage: number;
}

export class HistoryApiService extends ApiService {
  /** Declares its endpoint: `historyUrl` from public config (unset ⇒ empty history). */
  constructor(config: CapabilityConfig, client?: AxiosInstance) {
    super(config.historyUrl, client);
  }

  /**
   * One page of summaries (backend returns them newest-first). Unconfigured ⇒ an empty
   * page (no request). A non-2xx / malformed body throws; the hook swallows it and shows
   * an empty sidebar (no local fallback).
   */
  async list({ page, perPage }: HistoryListParams) {
    if (!this.configured) {
      return { items: [], page: 1, per_page: perPage, total: 0 };
    }
    return this.request(
      ConversationPageSchema,
      { method: "GET", params: { page, per_page: perPage } },
      "HistoryApi.list",
    );
  }

  /**
   * Full conversation by id (REQUIRED). Returns null when unconfigured or the id is
   * unknown (`404`). Callers that want the most recent resolve the id from `list()` first.
   */
  async load(id: string): Promise<Conversation | null> {
    if (!this.configured) return null;
    return this.requestOrNull(
      ConversationSchema,
      { method: "GET", url: `/${encodeURIComponent(id)}` },
      "HistoryApi.load",
    );
  }
}

// --- Summary helpers (pure; shared by dev mocks + sidebar titles) -------------

const MAX_TITLE_LEN = 48;

/** First user line → a trimmed title; an empty session reads as "New chat". */
export function conversationTitle(conversation: Conversation): string {
  const firstUser = conversation.messages.find((m) => m.role === "user");
  const text = (firstUser?.parts ?? [])
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
  if (!text) return "New chat";
  return text.length > MAX_TITLE_LEN ? `${text.slice(0, MAX_TITLE_LEN)}…` : text;
}

/**
 * Derive a sidebar list row from a full conversation. `updatedAt` is the last turn's
 * `createdAt` (0 for an empty session), so summaries sort newest-first consistently.
 */
export function summarizeConversation(
  conversation: Conversation,
): ConversationSummary {
  const last = conversation.messages[conversation.messages.length - 1];
  return {
    id: conversation.id,
    title: conversationTitle(conversation),
    updatedAt: last?.createdAt ?? 0,
    messageCount: conversation.messages.length,
  };
}
