import type { AxiosInstance } from "axios";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";

import type { Conversation } from "@/entities";
import {
  conversationTitle,
  HistoryApiService,
  summarizeConversation,
} from "@/lib/api/history";

function client(impl: (config: unknown) => Promise<{ data: unknown }>): AxiosInstance {
  return { request: vi.fn(impl) } as unknown as AxiosInstance;
}
function notFound(): AxiosError {
  return new AxiosError("nf", "ERR", undefined, undefined, {
    status: 404,
    data: {},
    statusText: "",
    headers: {},
    config: {} as never,
  });
}

const conversation: Conversation = {
  id: "c1",
  messages: [
    {
      id: "m1",
      role: "user",
      parts: [{ type: "text", text: "How do I read a Delta table?" }],
      attachments: [],
      status: "complete",
      error: null,
      feedback: null,
      createdAt: 5,
    },
  ],
};

const page = {
  items: [
    { id: "c1", title: "one", updatedAt: 3, messageCount: 2 },
    { id: "c2", title: "two", updatedAt: 2, messageCount: 1 },
  ],
  page: 1,
  per_page: 20,
  total: 42,
};

describe("HistoryApiService", () => {
  it("list parses the paginated envelope and requests page/per_page params", async () => {
    const c = client(async () => ({ data: page }));
    const api = new HistoryApiService({ historyUrl: "https://h" }, c);
    const result = await api.list({ page: 1, perPage: 20 });

    expect(result.total).toBe(42);
    expect(result.per_page).toBe(20);
    expect(result.items.map((i) => i.id)).toEqual(["c1", "c2"]);
    expect(c.request).toHaveBeenCalledWith(
      expect.objectContaining({ params: { page: 1, per_page: 20 } }),
    );
  });

  it("list returns an empty page without a request when unconfigured", async () => {
    const c = client(async () => ({ data: page }));
    const api = new HistoryApiService({}, c);
    const result = await api.list({ page: 1, perPage: 20 });

    expect(result).toEqual({ items: [], page: 1, per_page: 20, total: 0 });
    expect(c.request).not.toHaveBeenCalled();
  });

  it("list throws on a malformed body", async () => {
    const c = client(async () => ({ data: { items: "not-an-array" } }));
    const api = new HistoryApiService({ historyUrl: "https://h" }, c);
    await expect(api.list({ page: 1, perPage: 20 })).rejects.toThrow();
  });

  it("load returns the conversation directly (no envelope)", async () => {
    const c = client(async () => ({ data: conversation }));
    const api = new HistoryApiService({ historyUrl: "https://h" }, c);
    await expect(api.load("c1")).resolves.toEqual(conversation);
    expect(c.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/c1" }),
    );
  });

  it("load resolves to null on a 404", async () => {
    const c = client(async () => {
      throw notFound();
    });
    const api = new HistoryApiService({ historyUrl: "https://h" }, c);
    await expect(api.load("missing")).resolves.toBeNull();
  });

  it("load returns null without a request when unconfigured", async () => {
    const c = client(async () => ({ data: conversation }));
    const api = new HistoryApiService({}, c);
    await expect(api.load("c1")).resolves.toBeNull();
    expect(c.request).not.toHaveBeenCalled();
  });
});

describe("history summary helpers", () => {
  it("conversationTitle uses the first user line, truncated", () => {
    expect(conversationTitle(conversation)).toBe(
      "How do I read a Delta table?",
    );
  });

  it("summarizeConversation derives id/title/updatedAt/messageCount", () => {
    expect(summarizeConversation(conversation)).toEqual({
      id: "c1",
      title: "How do I read a Delta table?",
      updatedAt: 5,
      messageCount: 1,
    });
  });
});
