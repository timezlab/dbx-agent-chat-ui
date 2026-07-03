import { describe, expect, it, vi } from "vitest";

import type { Conversation, ConversationSummary } from "@/entities";
import { createRemoteHistory } from "@/lib/history/remote";

const sample: Conversation = {
  id: "c1",
  messages: [
    {
      id: "m1",
      role: "user",
      parts: [{ type: "text", text: "hi" }],
      attachments: [],
      status: "complete",
      error: null,
      feedback: null,
      createdAt: 5,
    },
  ],
  activeId: null,
  queue: [],
  status: "idle",
};

const summaries: ConversationSummary[] = [
  { id: "c1", title: "hi", updatedAt: 5, messageCount: 1 },
  { id: "c2", title: "older", updatedAt: 9, messageCount: 2 },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("remote history provider (US4)", () => {
  it("GETs the list and returns summaries newest-first", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ conversations: summaries }),
    );
    const provider = createRemoteHistory(
      "https://h.example/history",
      fetchMock as unknown as typeof fetch,
    );

    const result = await provider.list();
    expect(result.map((c) => c.id)).toEqual(["c2", "c1"]); // sorted by updatedAt desc
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://h.example/history");
    expect((init as RequestInit | undefined)?.method ?? "GET").toBe("GET");
  });

  it("GETs {url}/{id} for a specific conversation", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ conversation: sample }),
    );
    const provider = createRemoteHistory(
      "https://h.example/history",
      fetchMock as unknown as typeof fetch,
    );

    expect(await provider.load("c1")).toEqual(sample);
    expect(fetchMock.mock.calls[0][0]).toBe("https://h.example/history/c1");
  });

  it("load() with no id resolves the most recent from the list", async () => {
    const fetchMock = vi.fn(
      async (url: RequestInfo | URL, _init?: RequestInit) => {
        if (String(url).endsWith("/history"))
          return jsonResponse({ conversations: summaries });
        return jsonResponse({ conversation: sample });
      },
    );
    const provider = createRemoteHistory(
      "https://h.example/history",
      fetchMock as unknown as typeof fetch,
    );

    await provider.load();
    // list() first, then the newest (c2) is fetched by id.
    expect(fetchMock.mock.calls[0][0]).toBe("https://h.example/history");
    expect(fetchMock.mock.calls[1][0]).toBe("https://h.example/history/c2");
  });

  it("returns null when the server has no conversation for an id", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ conversation: null }));
    const provider = createRemoteHistory(
      "https://h.example/history",
      fetchMock as unknown as typeof fetch,
    );
    expect(await provider.load("missing")).toBeNull();
  });

  it("save is a no-op — the backend owns writes (no request made)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    const provider = createRemoteHistory(
      "https://h.example/history",
      fetchMock as unknown as typeof fetch,
    );
    await expect(provider.save(sample)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on a non-2xx response (so the caller can fail over)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "nope" }, 500));
    const provider = createRemoteHistory(
      "https://h.example/history",
      fetchMock as unknown as typeof fetch,
    );
    await expect(provider.list()).rejects.toBeInstanceOf(Error);
  });
});
