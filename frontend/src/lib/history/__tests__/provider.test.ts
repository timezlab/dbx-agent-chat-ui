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
    list: vi.fn(async () => []),
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
    await provider.list();
    expect(makeRemote).not.toHaveBeenCalled();
    expect(local.load).toHaveBeenCalled();
    expect(local.list).toHaveBeenCalled();
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

    expect(await provider.load("c1")).toEqual(sample);
    expect(remote.load).toHaveBeenCalled();
    expect(local.load).toHaveBeenCalled();
  });

  it("fails over to local when the remote list throws", async () => {
    const remote = spyProvider({
      list: vi.fn(async () => {
        throw new Error("network");
      }),
    });
    const summaries = [
      { id: "c1", title: "hi", updatedAt: 2, messageCount: 1 },
    ];
    const local = spyProvider({ list: vi.fn(async () => summaries) });
    const provider = resolveHistory(
      { historyUrl: "https://h.example" },
      { makeLocal: () => local, makeRemote: () => remote },
    );

    expect(await provider.list()).toEqual(summaries);
    expect(remote.list).toHaveBeenCalled();
    expect(local.list).toHaveBeenCalled();
  });

  it("writes only to local — the backend owns remote persistence", async () => {
    const remote = spyProvider();
    const local = spyProvider();
    const provider = resolveHistory(
      { historyUrl: "https://h.example" },
      { makeLocal: () => local, makeRemote: () => remote },
    );

    await provider.save(sample);
    // The UI never PUTs history; it keeps a local cache and lets the backend record.
    expect(remote.save).not.toHaveBeenCalled();
    expect(local.save).toHaveBeenCalledWith(sample);
  });
});
