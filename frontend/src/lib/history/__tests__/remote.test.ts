import { describe, expect, it, vi } from "vitest";

import type { Conversation } from "@/entities";
import { createRemoteHistory } from "@/lib/history/remote";

const sample: Conversation = {
  id: "c1",
  messages: [],
  activeId: null,
  queue: [],
  status: "idle",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("remote history provider (US4)", () => {
  it("GETs and returns the stored conversation", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ conversation: sample }),
    );
    const provider = createRemoteHistory(
      "https://h.example/history",
      fetchMock as unknown as typeof fetch,
    );

    expect(await provider.load()).toEqual(sample);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://h.example/history");
    expect((init as RequestInit | undefined)?.method ?? "GET").toBe("GET");
  });

  it("returns null when the server has no conversation", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ conversation: null }));
    const provider = createRemoteHistory(
      "https://h.example/history",
      fetchMock as unknown as typeof fetch,
    );
    expect(await provider.load()).toBeNull();
  });

  it("PUTs the conversation on save", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ ok: true }, 200),
    );
    const provider = createRemoteHistory(
      "https://h.example/history",
      fetchMock as unknown as typeof fetch,
    );
    await provider.save(sample);

    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      conversation: sample,
    });
  });

  it("throws on a non-2xx response (so the caller can fail over)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "nope" }, 500));
    const provider = createRemoteHistory(
      "https://h.example/history",
      fetchMock as unknown as typeof fetch,
    );
    await expect(provider.load()).rejects.toBeInstanceOf(Error);
  });
});
