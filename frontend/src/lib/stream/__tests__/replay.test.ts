import { describe, expect, it, vi } from "vitest";

import type { ChatStreamEvent } from "@/entities";
import { streamReplay } from "@/lib/stream/replay";

/** A frame that streams a text token. */
const token = (delta: string) =>
  `data: ${JSON.stringify({ type: "response.output_text.delta", delta })}`;

/** The terminal frame — an output_item.done with a message item maps to `done`. */
const terminal = `data: ${JSON.stringify({
  type: "response.output_item.done",
  item: { type: "message" },
})}`;

/** A tool-call frame (paced by the tool delay). */
const toolCall = `data: ${JSON.stringify({
  type: "response.output_item.done",
  item: { type: "function_call", call_id: "c1", name: "sql", arguments: "{}" },
})}`;

const rec = (...frames: string[]) => frames.join("\n\n") + "\n\n";

/** Collect events + the single terminal reason. `sleep` is a no-op (fast). */
function collect() {
  const events: ChatStreamEvent[] = [];
  const closes: Array<"done" | "error" | "abort"> = [];
  return {
    events,
    closes,
    handlers: {
      onEvent: (e: ChatStreamEvent) => events.push(e),
      onClose: (r: "done" | "error" | "abort") => closes.push(r),
    },
  };
}

const noSleep = () => Promise.resolve();

describe("streamReplay — terminal contract", () => {
  it("emits exactly one done terminal after the final frame", async () => {
    const { events, closes, handlers } = collect();
    streamReplay({
      recording: rec(token("Hello "), token("world"), terminal),
      handlers,
      sleep: noSleep,
    });
    await vi.waitFor(() => expect(closes).toEqual(["done"]));
    expect(events.filter((e) => e.type === "token")).toHaveLength(2);
    expect(events.some((e) => e.type === "done")).toBe(true);
  });

  it("surfaces error for an empty recording", async () => {
    const { closes, handlers } = collect();
    streamReplay({ recording: "", handlers, sleep: noSleep });
    await vi.waitFor(() => expect(closes).toEqual(["error"]));
  });

  it("surfaces error for an all-malformed recording", async () => {
    const { closes, handlers } = collect();
    streamReplay({
      recording: rec("data: not-json", "data: still-bad"),
      handlers,
      sleep: noSleep,
    });
    await vi.waitFor(() => expect(closes).toEqual(["error"]));
  });

  it("skips an individual malformed frame without aborting the run", async () => {
    const { events, closes, handlers } = collect();
    streamReplay({
      recording: rec(token("ok"), "data: {bad json", terminal),
      handlers,
      sleep: noSleep,
    });
    await vi.waitFor(() => expect(closes).toEqual(["done"]));
    expect(events.filter((e) => e.type === "token")).toHaveLength(1);
  });

  it("routes a recorded error frame through onEvent and closes error", async () => {
    const { events, closes, handlers } = collect();
    streamReplay({
      recording: rec(token("hi"), 'data: {"error":"boom"}'),
      handlers,
      sleep: noSleep,
    });
    await vi.waitFor(() => expect(closes).toEqual(["error"]));
    expect(
      events.some((e) => e.type === "error" && e.message === "boom"),
    ).toBe(true);
  });
});

describe("streamReplay — abort", () => {
  it("settles to a single abort terminal, idempotently", async () => {
    const { closes, handlers } = collect();
    // A sleep that never resolves would hang; use a controllable gate instead.
    let release: (() => void) | null = null;
    const gatedSleep = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const handle = streamReplay({
      recording: rec(token("a"), token("b"), terminal),
      handlers,
      sleep: gatedSleep,
    });
    handle.abort();
    handle.abort(); // idempotent
    // Releasing the pending sleep must not resurrect the loop into another terminal.
    release?.();
    await vi.waitFor(() => expect(closes).toEqual(["abort"]));
    expect(handle.status).toBe("done");
  });
});
