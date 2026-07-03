import { describe, expect, it, vi } from "vitest";

import type { Identity } from "@/entities";
import { resolveIdentity } from "@/lib/identity/client";
import { createRemoteIdentity } from "@/lib/identity/remote";

const identity: Identity = {
  email: "dai.le@timezlab.org",
  username: "dai.le",
  user_id: "u-1",
  session_id: "s-1",
  auth_type: "DB_SAML_SSO",
  org_id: "org-1",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("identity client", () => {
  it("resolves to null when no meUrl is set (chip hidden)", () => {
    expect(resolveIdentity({})).toBeNull();
  });

  it("resolves to a remote client when a meUrl is set", () => {
    const makeRemote = vi.fn(() => ({ me: vi.fn(async () => identity) }));
    const client = resolveIdentity(
      { meUrl: "https://x.example/me" },
      { makeRemote },
    );
    expect(client).not.toBeNull();
    expect(makeRemote).toHaveBeenCalledWith("https://x.example/me");
  });

  it("remote me() GETs the URL and returns the parsed identity", async () => {
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(identity),
    );
    const client = createRemoteIdentity(
      "https://x.example/me",
      fetchMock as unknown as typeof fetch,
    );
    await expect(client.me()).resolves.toEqual(identity);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://x.example/me");
    expect((init as RequestInit | undefined)?.method ?? "GET").toBe("GET");
  });

  it("remote me() accepts a minimal payload (email + username only)", async () => {
    const minimal = { email: "solo@timezlab.org", username: "solo" };
    const fetchMock = vi.fn(async () => jsonResponse(minimal));
    const client = createRemoteIdentity(
      "https://x.example/me",
      fetchMock as unknown as typeof fetch,
    );
    await expect(client.me()).resolves.toEqual(minimal);
  });

  it("remote me() rejects when username is missing (contract requires it)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ email: "solo@timezlab.org" }),
    );
    const client = createRemoteIdentity(
      "https://x.example/me",
      fetchMock as unknown as typeof fetch,
    );
    await expect(client.me()).rejects.toBeInstanceOf(Error);
  });

  it("remote me() rejects on a non-2xx response (hook demotes to no chip)", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    const client = createRemoteIdentity(
      "https://x.example/me",
      fetchMock as unknown as typeof fetch,
    );
    await expect(client.me()).rejects.toBeInstanceOf(Error);
  });

  it("remote me() rejects when email is missing (contract requires it)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ user_id: "u-1" }));
    const client = createRemoteIdentity(
      "https://x.example/me",
      fetchMock as unknown as typeof fetch,
    );
    await expect(client.me()).rejects.toBeInstanceOf(Error);
  });

  it("remote me() rejects on an invalid auth_type (enum contract)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ email: "x@y.z", auth_type: "OAUTH" }),
    );
    const client = createRemoteIdentity(
      "https://x.example/me",
      fetchMock as unknown as typeof fetch,
    );
    await expect(client.me()).rejects.toBeInstanceOf(Error);
  });
});
