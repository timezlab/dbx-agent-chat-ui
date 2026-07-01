import { describe, expect, it } from "vitest";

import { dequeue, enqueue, isBlank } from "@/lib/chat/queue";

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
  it("appends sendable text in FIFO order", () => {
    let q: string[] = [];
    q = enqueue(q, "first");
    q = enqueue(q, "second");
    expect(q).toEqual(["first", "second"]);
  });

  it("rejects blank input (no enqueue)", () => {
    expect(enqueue(["a"], "   ")).toEqual(["a"]);
    expect(enqueue([], "")).toEqual([]);
  });

  it("is pure — does not mutate the input queue", () => {
    const q0 = ["a"];
    const q1 = enqueue(q0, "b");
    expect(q0).toEqual(["a"]);
    expect(q1).not.toBe(q0);
  });
});

describe("dequeue", () => {
  it("pops the head (FIFO) and returns the rest", () => {
    expect(dequeue(["first", "second"])).toEqual({
      next: "first",
      queue: ["second"],
    });
  });

  it("returns null next for an empty queue", () => {
    expect(dequeue([])).toEqual({ next: null, queue: [] });
  });

  it("is pure — does not mutate the input queue", () => {
    const q0 = ["a", "b"];
    dequeue(q0);
    expect(q0).toEqual(["a", "b"]);
  });
});
