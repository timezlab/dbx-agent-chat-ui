import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Identity } from "@/entities";
import { useIdentity } from "@/hooks/identity/use-identity";

const identity: Identity = {
  email: "dai.le@timezlab.org",
  username: "dai.le",
  user_id: "u-1",
  auth_type: "PAT",
};

type IdentityService = { me: () => Promise<Identity | null> };

describe("useIdentity", () => {
  it("stays null/unavailable when no meUrl is configured", () => {
    const { result } = renderHook(() => useIdentity({ config: {} }));
    expect(result.current.identity).toBeNull();
    expect(result.current.available).toBe(false);
  });

  it("loads the identity once and becomes available", async () => {
    const service: IdentityService = { me: vi.fn(async () => identity) };
    const { result } = renderHook(() =>
      useIdentity({ config: { meUrl: "https://x.example" }, service }),
    );

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.identity).toEqual(identity);
    expect(service.me).toHaveBeenCalledOnce();
  });

  it("stays unavailable when me() rejects (chip hidden)", async () => {
    const service: IdentityService = {
      me: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const { result } = renderHook(() =>
      useIdentity({ config: { meUrl: "https://x.example" }, service }),
    );

    await waitFor(() => expect(service.me).toHaveBeenCalledOnce());
    expect(result.current.available).toBe(false);
    expect(result.current.identity).toBeNull();
  });
});
