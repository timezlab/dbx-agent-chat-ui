import { describe, expect, it } from "vitest";

import type { ChatSession } from "@/entities";
import { reduceStreamEvent } from "@/lib/chat/reducer";

/** A conversation with one complete user turn + one streaming assistant turn. */
function streamingConversation(): ChatSession {
  return {
    id: "c1",
    activeId: "a1",
    queue: [],
    status: "streaming",
    messages: [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
        attachments: [],
        status: "complete",
        error: null,
        feedback: null,
        createdAt: 1,
      },
      {
        id: "a1",
        role: "assistant",
        parts: [],
        attachments: [],
        status: "streaming",
        error: null,
        feedback: null,
        createdAt: 2,
      },
    ],
  };
}

const active = (c: ChatSession) => c.messages.find((m) => m.id === c.activeId)!;
const assistant = (c: ChatSession) => c.messages.find((m) => m.id === "a1")!;

describe("reduceStreamEvent — tokens", () => {
  it("opens a text part on the first token and grows it on subsequent tokens", () => {
    let c = streamingConversation();
    c = reduceStreamEvent(c, { type: "token", delta: "Hel" });
    c = reduceStreamEvent(c, { type: "token", delta: "lo" });

    expect(assistant(c).parts).toEqual([{ type: "text", text: "Hello" }]);
    expect(assistant(c).status).toBe("streaming");
  });

  it("skips a leading whitespace-only delta, then opens on the first real content", () => {
    // The RBG recording emits a lone `" "` output_text delta before the real answer;
    // a bare space at a part boundary is model padding and must not open a stray part
    // (which would split the reasoning/tools run out of one process group).
    let c = streamingConversation();
    c = reduceStreamEvent(c, { type: "token", delta: " " });
    expect(assistant(c).parts).toEqual([]);

    c = reduceStreamEvent(c, { type: "token", delta: "Now I" });
    c = reduceStreamEvent(c, { type: "token", delta: " have all" });
    expect(assistant(c).parts).toEqual([
      { type: "text", text: "Now I have all" },
    ]);
  });

  it("left-trims leading whitespace only when opening a part, not mid-part", () => {
    let c = streamingConversation();
    c = reduceStreamEvent(c, { type: "token", delta: "  Hello" });
    c = reduceStreamEvent(c, { type: "token", delta: "  world" });
    // Boundary space dropped once; the interior space stays a word separator.
    expect(assistant(c).parts).toEqual([
      { type: "text", text: "Hello  world" },
    ]);
  });

  it("does not mutate the input conversation (pure)", () => {
    const c0 = streamingConversation();
    const c1 = reduceStreamEvent(c0, { type: "token", delta: "x" });

    expect(c0).not.toBe(c1);
    expect(assistant(c0).parts).toEqual([]);
  });

  it("only mutates the active message, leaving earlier turns untouched", () => {
    let c = streamingConversation();
    const userBefore = assistant(c);
    void userBefore;
    c = reduceStreamEvent(c, { type: "token", delta: "hi" });

    expect(c.messages[0].parts).toEqual([{ type: "text", text: "hello" }]);
    expect(active(c).id).toBe("a1");
  });

  it("ignores events when there is no active message", () => {
    const idle: ChatSession = {
      ...streamingConversation(),
      activeId: null,
      status: "idle",
    };
    expect(reduceStreamEvent(idle, { type: "token", delta: "x" })).toEqual(idle);
  });
});

describe("reduceStreamEvent — reasoning", () => {
  it("skips a leading whitespace-only reasoning delta when opening the part", () => {
    let c = streamingConversation();
    c = reduceStreamEvent(c, { type: "reasoning", delta: " " });
    expect(assistant(c).parts).toEqual([]);

    c = reduceStreamEvent(c, { type: "reasoning", delta: "Người" });
    c = reduceStreamEvent(c, { type: "reasoning", delta: " dùng" });
    expect(assistant(c).parts).toEqual([
      { type: "reasoning", text: "Người dùng" },
    ]);
  });
});

describe("reduceStreamEvent — done", () => {
  it("completes the active turn, clears activeId and goes idle", () => {
    let c = streamingConversation();
    c = reduceStreamEvent(c, { type: "token", delta: "answer" });
    c = reduceStreamEvent(c, { type: "done" });

    expect(assistant(c).status).toBe("complete");
    expect(c.activeId).toBeNull();
    expect(c.status).toBe("idle");
  });

  it("drops empty-after-trim text parts on done (e.g. a whitespace-only burst)", () => {
    let c = streamingConversation();
    c = reduceStreamEvent(c, { type: "token", delta: "   " });
    c = reduceStreamEvent(c, { type: "done" });

    expect(assistant(c).parts).toEqual([]);
    expect(assistant(c).status).toBe("complete");
  });

  it("keeps non-empty text parts on done", () => {
    let c = streamingConversation();
    c = reduceStreamEvent(c, { type: "token", delta: "kept" });
    c = reduceStreamEvent(c, { type: "done" });

    expect(assistant(c).parts).toEqual([{ type: "text", text: "kept" }]);
  });
});
