"use client";

import { useCallback, useMemo } from "react";
import {
  type InfiniteData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  CapabilityConfig,
  ConversationPage,
  ConversationSummary,
} from "@/entities";
import { DEFAULT_PER_PAGE, HistoryApiService } from "@/lib/api/history";

/** Shared cache key prefix — mutations match every page-size/URL variant by this prefix. */
const HISTORY_LIST_KEY = ["history", "list"] as const;

export interface UseConversationsInfiniteOptions {
  config: CapabilityConfig;
  /** Page size (page-by-page infinite scroll). Defaults to `DEFAULT_PER_PAGE`. */
  perPage?: number;
  /** Injectable service for tests; defaults to `new HistoryApiService(config)`. */
  service?: Pick<HistoryApiService, "list">;
}

export interface UseConversationsInfiniteResult {
  /** Flattened summaries across all fetched pages, newest-first. */
  conversations: ConversationSummary[];
  /** Total rows the backend reports (across all pages). */
  total: number;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
}

/**
 * Paginated sidebar history via `useInfiniteQuery`, fetched ONE page at a time (increment
 * `page`, never grow `per_page`). Disabled — no fetch, empty list — when `historyUrl` is
 * unset (backend-only; there is no local fallback). `getNextPageParam` stops once the
 * pages seen cover `total`.
 */
export function useConversationsInfinite(
  options: UseConversationsInfiniteOptions,
): UseConversationsInfiniteResult {
  const { config, perPage = DEFAULT_PER_PAGE } = options;
  const service = useMemo(
    () => options.service ?? new HistoryApiService(config),
    [options.service, config],
  );

  const query = useInfiniteQuery({
    queryKey: [...HISTORY_LIST_KEY, config.historyUrl ?? "none", perPage],
    queryFn: ({ pageParam }) => service.list({ page: pageParam, perPage }),
    initialPageParam: 1,
    // Decide the next page from what we've ACTUALLY accumulated, never from the response's
    // echoed `page`. A static-export host ignores `?page` and re-serves page 1 forever — if
    // we trusted `last.page` (always 1) we'd loop page 2 endlessly. The next page NUMBER is
    // the count of pages fetched so far (position); stop when the latest page added no new
    // ids, or we've already seen every row `total` promises.
    getNextPageParam: (lastPage, allPages) => {
      const before = new Set(
        allPages.slice(0, -1).flatMap((p) => p.items.map((i) => i.id)),
      );
      const all = new Set(allPages.flatMap((p) => p.items.map((i) => i.id)));
      if (all.size === before.size) return undefined; // latest page brought nothing new
      if (all.size >= lastPage.total) return undefined; // seen every row
      return allPages.length + 1;
    },
    enabled: Boolean(config.historyUrl),
  });

  // Flatten newest-first, de-duplicating by id: a static host that re-serves page 1 (or any
  // backend whose pages overlap) must not yield duplicate rows / clashing React keys.
  const conversations = useMemo(() => {
    const seen = new Set<string>();
    const out: ConversationSummary[] = [];
    for (const p of query.data?.pages ?? []) {
      for (const it of p.items) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        out.push(it);
      }
    }
    return out;
  }, [query.data]);
  const total = query.data?.pages[query.data.pages.length - 1]?.total ?? 0;

  return {
    conversations,
    total,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
  };
}

export interface UseHistoryMutationsResult {
  /** Optimistically move/insert a summary at the top of page 1 (after a settled turn). */
  prependConversation: (summary: ConversationSummary) => void;
  /** Re-fetch the list from the backend (reconcile the optimistic update). */
  invalidate: () => void;
}

/**
 * Cache helpers for the terminal-turn path: prepend the just-settled conversation to the
 * top of the list (optimistic), then invalidate so the backend's authoritative ordering
 * reconciles. Matches every cached page-size/URL variant by the `["history","list"]`
 * prefix.
 */
export function useHistoryMutations(): UseHistoryMutationsResult {
  const queryClient = useQueryClient();

  const prependConversation = useCallback(
    (summary: ConversationSummary) => {
      queryClient.setQueriesData<InfiniteData<ConversationPage, number>>(
        { queryKey: HISTORY_LIST_KEY },
        (old) => {
          if (!old || old.pages.length === 0) return old;
          const [first, ...rest] = old.pages;
          const items = [
            summary,
            ...first.items.filter((c) => c.id !== summary.id),
          ];
          return { ...old, pages: [{ ...first, items }, ...rest] };
        },
      );
    },
    [queryClient],
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: HISTORY_LIST_KEY });
  }, [queryClient]);

  return { prependConversation, invalidate };
}
