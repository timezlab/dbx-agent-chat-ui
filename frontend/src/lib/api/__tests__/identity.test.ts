import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";

import type { Identity } from "@/entities";
import { IdentityApiService } from "@/lib/api/identity";

function client(data: unknown): AxiosInstance {
  return { request: vi.fn(async () => ({ data })) } as unknown as AxiosInstance;
}

const identity: Identity = {
  email: "dai.le@timezlab.org",
  username: "dai.le",
  user_id: "u-1",
  auth_type: "PAT",
};

describe("IdentityApiService", () => {
  it("me parses the identity when configured", async () => {
    const c = client(identity);
    const api = new IdentityApiService({ meUrl: "https://m" }, c);
    await expect(api.me()).resolves.toEqual(identity);
  });

  it("me returns null without a request when unconfigured", async () => {
    const c = client(identity);
    const api = new IdentityApiService({}, c);
    await expect(api.me()).resolves.toBeNull();
    expect(c.request).not.toHaveBeenCalled();
  });

  it("me throws on a malformed body (missing email)", async () => {
    const c = client({ username: "no-email" });
    const api = new IdentityApiService({ meUrl: "https://m" }, c);
    await expect(api.me()).rejects.toThrow();
  });
});
