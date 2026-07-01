import { describe, expect, it } from "vitest";

import type { Conversation } from "@/entities";
import { createLocalHistory, type StorageLike } from "@/lib/history/local";

const sample: Conversation = {
  id: "c1",
  messages: [
    {
      id: "m1",
      role: "user",
      parts: [{ type: "text", text: "hi" }],
      status: "complete",
      error: null,
      feedback: null,
      createdAt: 1,
    },
  ],
  activeId: null,
  queue: [],
  status: "idle",
};

function memStorage(seed?: Record<string, string>): StorageLike {
  const m = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
    removeItem: (k) => {
      m.delete(k);
    },
  };
}

describe("local history provider (US4)", () => {
  it("persists and restores a conversation", async () => {
    const provider = createLocalHistory({ key: "k", storage: memStorage() });
    await provider.save(sample);
    expect(await provider.load()).toEqual(sample);
  });

  it("returns null when nothing is stored", async () => {
    const provider = createLocalHistory({ key: "k", storage: memStorage() });
    expect(await provider.load()).toBeNull();
  });

  it("returns null (clean session) on corrupt/invalid stored data", async () => {
    const bad = createLocalHistory({
      key: "k",
      storage: memStorage({ k: "{not json" }),
    });
    expect(await bad.load()).toBeNull();

    const wrongShape = createLocalHistory({
      key: "k",
      storage: memStorage({ k: JSON.stringify({ nope: true }) }),
    });
    expect(await wrongShape.load()).toBeNull();
  });

  it("degrades to in-memory when storage throws (private mode)", async () => {
    const throwing: StorageLike = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };
    const provider = createLocalHistory({ key: "k", storage: throwing });
    // Neither call throws; the value round-trips via the in-memory fallback.
    await expect(provider.save(sample)).resolves.toBeUndefined();
    expect(await provider.load()).toEqual(sample);
  });
});
