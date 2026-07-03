import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Identity } from "@/entities";
import { useIdentity } from "@/hooks/identity/use-identity";
import type { IdentityClient } from "@/lib/identity/client";

const identity: Identity = {
  email: "dai.le@timezlab.org",
  username: "dai.le",
  user_id: "u-1",
  auth_type: "PAT",
};

describe("useIdentity", () => {
  it("stays null/unavailable when no meUrl is configured (client resolves to null)", () => {
    const { result } = renderHook(() => useIdentity({ config: {} }));
    expect(result.current.identity).toBeNull();
    expect(result.current.available).toBe(false);
  });

  it("loads the identity once and becomes available", async () => {
    const client: IdentityClient = { me: vi.fn(async () => identity) };
    const { result } = renderHook(() =>
      useIdentity({ config: { meUrl: "https://x.example" }, client }),
    );

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.identity).toEqual(identity);
    expect(client.me).toHaveBeenCalledOnce();
  });

  it("stays unavailable when me() rejects (chip hidden)", async () => {
    const client: IdentityClient = {
      me: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const { result } = renderHook(() =>
      useIdentity({ config: { meUrl: "https://x.example" }, client }),
    );

    await waitFor(() => expect(client.me).toHaveBeenCalledOnce());
    expect(result.current.available).toBe(false);
    expect(result.current.identity).toBeNull();
  });
});
