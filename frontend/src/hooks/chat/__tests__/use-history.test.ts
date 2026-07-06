import * as React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CapabilityConfig, ConversationSummary } from "@/entities";
import {
  useConversationsInfinite,
  useHistoryMutations,
} from "@/hooks/chat/use-history";

const config: CapabilityConfig = { historyUrl: "https://h.example" };

function makeItems(start: number, count: number): ConversationSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${start + i}`,
    title: `conv ${start + i}`,
    updatedAt: 1000 - (start + i),
    messageCount: 1,
  }));
}

// One QueryClient per test, torn down afterwards, so an in-flight query from one case
// never bleeds into the next (which otherwise wedges the following renderHook).
let queryClient: QueryClient;
beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
});
afterEach(() => {
  queryClient.clear();
});

function wrapper() {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe("useConversationsInfinite (US1)", () => {
  it("accumulates pages one at a time and stops at total", async () => {
    const service = {
      list: vi.fn(async ({ page }: { page: number; perPage: number }) =>
        page === 1
          ? { items: makeItems(1, 20), page: 1, per_page: 20, total: 25 }
          : { items: makeItems(21, 5), page: 2, per_page: 20, total: 25 },
      ),
    };
    const { result } = renderHook(
      () => useConversationsInfinite({ config, service, perPage: 20 }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.conversations).toHaveLength(20));
    expect(result.current.hasNextPage).toBe(true);

    // Await the fetch INSIDE act — an un-awaited async update leaves React's act queue
    // dirty and wedges the next test's renderHook.
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.conversations).toHaveLength(25));
    expect(result.current.hasNextPage).toBe(false);
    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it("stops (no infinite fetch, no duplicate rows) when a static host ignores ?page", async () => {
    // Static-export hosting can't enumerate query params, so it re-serves page 1 for every
    // `?page` — echoing `page: 1` with the SAME items while `total` still promises more.
    // The old `last.page`-based paging looped page 2 forever; guard that it now halts.
    const service = {
      list: vi.fn(async () => ({
        items: makeItems(1, 20),
        page: 1,
        per_page: 20,
        total: 25,
      })),
    };
    const { result } = renderHook(
      () => useConversationsInfinite({ config, service, perPage: 20 }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.conversations).toHaveLength(20));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    // The re-served page adds nothing new → paging stops, and the duplicate items are
    // de-duped so the list stays at the 20 unique rows (never 40, never looping).
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(result.current.conversations).toHaveLength(20);
    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it("is disabled (no fetch, empty list) when historyUrl is unset", async () => {
    const service = { list: vi.fn(async () => ({ items: [], page: 1, per_page: 20, total: 0 })) };
    const { result } = renderHook(
      () => useConversationsInfinite({ config: {}, service }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current).toBeTruthy());
    expect(result.current.conversations).toEqual([]);
    expect(service.list).not.toHaveBeenCalled();
  });
});

describe("useHistoryMutations (US1 optimistic)", () => {
  it("prepends a settled conversation to the top of the list", async () => {
    const service = {
      list: vi.fn(async () => ({
        items: makeItems(1, 3),
        page: 1,
        per_page: 20,
        total: 3,
      })),
    };
    const { result } = renderHook(
      () => ({
        list: useConversationsInfinite({ config, service, perPage: 20 }),
        mutations: useHistoryMutations(),
      }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.list.conversations).toHaveLength(3));

    const fresh: ConversationSummary = {
      id: "c-new",
      title: "just settled",
      updatedAt: 9999,
      messageCount: 2,
    };
    act(() => result.current.mutations.prependConversation(fresh));

    await waitFor(() =>
      expect(result.current.list.conversations[0]?.id).toBe("c-new"),
    );
    expect(result.current.list.conversations).toHaveLength(4);
  });
});
