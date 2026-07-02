import { describe, expect, it, vi } from "vitest";

import { resolveAgents } from "@/lib/agents/client";
import { createRemoteAgents } from "@/lib/agents/remote";

const agents = [
  { id: "a1", name: "Analyst" },
  { id: "a2", name: "Coder" },
];

describe("agents client (US5)", () => {
  it("resolves to null when no agents URL is set (selector hidden, FR-026)", () => {
    expect(resolveAgents({})).toBeNull();
  });

  it("resolves to a remote client when an agents URL is set", () => {
    const makeRemote = vi.fn(() => ({ list: vi.fn(async () => agents) }));
    const client = resolveAgents(
      { agentsUrl: "https://a.example/agents" },
      { makeRemote },
    );
    expect(client).not.toBeNull();
    expect(makeRemote).toHaveBeenCalledWith("https://a.example/agents");
  });

  it("remote list() GETs the URL and returns the parsed agents", async () => {
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ agents }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const client = createRemoteAgents(
      "https://a.example/agents",
      fetchMock as unknown as typeof fetch,
    );
    await expect(client.list()).resolves.toEqual(agents);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://a.example/agents");
    expect((init as RequestInit | undefined)?.method ?? "GET").toBe("GET");
  });

  it("remote list() rejects on a non-2xx response (hook demotes to no selector)", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    const client = createRemoteAgents(
      "https://a.example/agents",
      fetchMock as unknown as typeof fetch,
    );
    await expect(client.list()).rejects.toBeInstanceOf(Error);
  });

  it("remote list() rejects on a malformed payload (not the {agents} shape)", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ nope: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const client = createRemoteAgents(
      "https://a.example/agents",
      fetchMock as unknown as typeof fetch,
    );
    await expect(client.list()).rejects.toBeInstanceOf(Error);
  });
});
