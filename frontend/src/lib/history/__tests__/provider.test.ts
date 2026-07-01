import { describe, expect, it, vi } from "vitest";

import type { Conversation } from "@/entities";
import type { HistoryProvider } from "@/lib/history/provider";
import { resolveHistory } from "@/lib/history/provider";

const sample: Conversation = {
  id: "c1",
  messages: [],
  activeId: null,
  queue: [],
  status: "idle",
};

function spyProvider(over: Partial<HistoryProvider> = {}): HistoryProvider {
  return {
    load: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    ...over,
  };
}

describe("resolveHistory (US4)", () => {
  it("uses local only when no history URL is set", async () => {
    const local = spyProvider();
    const makeRemote = vi.fn();
    const provider = resolveHistory(
      {},
      { makeLocal: () => local, makeRemote },
    );
    await provider.load();
    expect(makeRemote).not.toHaveBeenCalled();
    expect(local.load).toHaveBeenCalled();
  });

  it("fails over to local when the remote load throws", async () => {
    const remote = spyProvider({
      load: vi.fn(async () => {
        throw new Error("network");
      }),
    });
    const local = spyProvider({ load: vi.fn(async () => sample) });
    const provider = resolveHistory(
      { historyUrl: "https://h.example" },
      { makeLocal: () => local, makeRemote: () => remote },
    );

    expect(await provider.load()).toEqual(sample);
    expect(remote.load).toHaveBeenCalled();
    expect(local.load).toHaveBeenCalled();
  });

  it("fails over to local when the remote save throws", async () => {
    const remote = spyProvider({
      save: vi.fn(async () => {
        throw new Error("network");
      }),
    });
    const local = spyProvider();
    const provider = resolveHistory(
      { historyUrl: "https://h.example" },
      { makeLocal: () => local, makeRemote: () => remote },
    );

    await expect(provider.save(sample)).resolves.toBeUndefined();
    expect(remote.save).toHaveBeenCalled();
    expect(local.save).toHaveBeenCalledWith(sample);
  });
});
