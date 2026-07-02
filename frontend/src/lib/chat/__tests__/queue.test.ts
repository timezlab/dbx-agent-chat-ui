import { describe, expect, it } from "vitest";

import type { Attachment, QueuedMessage } from "@/entities";
import { dequeue, enqueue, isBlank } from "@/lib/chat/queue";

const img: Attachment = {
  id: "a1",
  name: "photo.png",
  mimeType: "image/png",
  size: 10,
  dataUrl: "data:image/png;base64,AAAA",
};

function q(over: Partial<QueuedMessage> = {}): QueuedMessage {
  return { id: "q1", text: "a", attachments: [], ...over };
}

describe("isBlank", () => {
  it("treats empty / whitespace-only input as blank", () => {
    expect(isBlank("")).toBe(true);
    expect(isBlank("   ")).toBe(true);
    expect(isBlank("\n\t ")).toBe(true);
  });

  it("treats any non-whitespace input as sendable", () => {
    expect(isBlank("hi")).toBe(false);
    expect(isBlank("  hi  ")).toBe(false);
  });
});

describe("enqueue", () => {
  it("appends sendable text in FIFO order under the given id, no attachments by default", () => {
    let queue = enqueue([], "id1", "first");
    queue = enqueue(queue, "id2", "second");
    expect(queue).toEqual([
      { id: "id1", text: "first", attachments: [] },
      { id: "id2", text: "second", attachments: [] },
    ]);
  });

  it("carries attachments alongside the text (T071)", () => {
    const queue = enqueue([], "id1", "with a photo", [img]);
    expect(queue).toEqual([{ id: "id1", text: "with a photo", attachments: [img] }]);
  });

  it("rejects blank input (no enqueue), even with attachments", () => {
    expect(enqueue([q({ id: "id0", text: "a" })], "id1", "   ")).toEqual([
      q({ id: "id0", text: "a" }),
    ]);
    expect(enqueue([], "id1", "", [img])).toEqual([]);
  });

  it("is pure — does not mutate the input queue", () => {
    const q0 = [q({ id: "id0", text: "a" })];
    const q1 = enqueue(q0, "id1", "b");
    expect(q0).toEqual([q({ id: "id0", text: "a" })]);
    expect(q1).not.toBe(q0);
  });
});

describe("dequeue", () => {
  it("pops the head (FIFO) and returns the rest", () => {
    const first = q({ id: "id1", text: "first", attachments: [img] });
    const second = q({ id: "id2", text: "second" });
    expect(dequeue([first, second])).toEqual({
      next: first,
      queue: [second],
    });
  });

  it("returns null next for an empty queue", () => {
    expect(dequeue([])).toEqual({ next: null, queue: [] });
  });

  it("is pure — does not mutate the input queue", () => {
    const q0 = [q({ id: "id1", text: "a" }), q({ id: "id2", text: "b" })];
    dequeue(q0);
    expect(q0).toHaveLength(2);
  });
});
