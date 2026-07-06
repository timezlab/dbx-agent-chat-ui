import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";

import { AgentsApiService } from "@/lib/api/agents";

function client(data: unknown): AxiosInstance {
  return { request: vi.fn(async () => ({ data })) } as unknown as AxiosInstance;
}

describe("AgentsApiService", () => {
  it("list parses the { agents } envelope", async () => {
    const c = client({ agents: [{ id: "a1", name: "Analyst" }] });
    const api = new AgentsApiService({ agentsUrl: "https://a" }, c);
    await expect(api.list()).resolves.toEqual([{ id: "a1", name: "Analyst" }]);
  });

  it("list returns [] without a request when unconfigured", async () => {
    const c = client({ agents: [{ id: "a1", name: "Analyst" }] });
    const api = new AgentsApiService({}, c);
    await expect(api.list()).resolves.toEqual([]);
    expect(c.request).not.toHaveBeenCalled();
  });

  it("list throws on a malformed body", async () => {
    const c = client({ agents: [{ id: 1 }] });
    const api = new AgentsApiService({ agentsUrl: "https://a" }, c);
    await expect(api.list()).rejects.toThrow();
  });
});
