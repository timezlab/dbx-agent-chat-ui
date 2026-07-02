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
      attachments: [],
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

  it("strips attachment dataUrl before persisting (T071 — session-only file bytes)", async () => {
    const withAttachment: Conversation = {
      ...sample,
      messages: [
        {
          ...sample.messages[0],
          attachments: [
            {
              id: "a1",
              name: "photo.png",
              mimeType: "image/png",
              size: 10,
              dataUrl: "data:image/png;base64,AAAA",
            },
          ],
        },
      ],
    };
    const storage = memStorage();
    const provider = createLocalHistory({ key: "k", storage });
    await provider.save(withAttachment);

    // The raw persisted JSON must not contain the base64 payload.
    expect(storage.getItem("k")).not.toContain("AAAA");

    const restored = await provider.load();
    expect(restored?.messages[0].attachments).toEqual([
      { id: "a1", name: "photo.png", mimeType: "image/png", size: 10, dataUrl: "" },
    ]);
  });

  it("never persists the queue — it is a transient send buffer (T071)", async () => {
    const withQueue: Conversation = {
      ...sample,
      queue: [
        {
          id: "q1",
          text: "still waiting to send",
          attachments: [
            {
              id: "qa1",
              name: "queued.png",
              mimeType: "image/png",
              size: 10,
              dataUrl: "data:image/png;base64,ZZZZ",
            },
          ],
        },
      ],
    };
    const storage = memStorage();
    const provider = createLocalHistory({ key: "k", storage });
    await provider.save(withQueue);

    // Neither the queued text nor its base64 bytes reach persistent storage.
    expect(storage.getItem("k")).not.toContain("still waiting to send");
    expect(storage.getItem("k")).not.toContain("ZZZZ");

    const restored = await provider.load();
    expect(restored?.queue).toEqual([]);
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
