import { describe, expect, it } from "vitest";

import type { Conversation, Message } from "@/entities";
import {
  conversationTitle,
  summarizeConversation,
} from "@/lib/history/summary";

function msg(over: Partial<Message> & Pick<Message, "id" | "role">): Message {
  return {
    parts: [],
    attachments: [],
    status: "complete",
    error: null,
    feedback: null,
    createdAt: 0,
    ...over,
  };
}

function conv(messages: Message[], id = "c"): Conversation {
  return { id, messages, activeId: null, queue: [], status: "idle" };
}

describe("conversationTitle", () => {
  it("uses the first user line", () => {
    const c = conv([
      msg({ id: "1", role: "user", parts: [{ type: "text", text: "Hello world" }] }),
      msg({ id: "2", role: "assistant", parts: [{ type: "text", text: "hi" }] }),
    ]);
    expect(conversationTitle(c)).toBe("Hello world");
  });

  it("falls back to 'New chat' for an empty session", () => {
    expect(conversationTitle(conv([]))).toBe("New chat");
  });

  it("truncates a long title with an ellipsis", () => {
    const long = "x".repeat(80);
    const c = conv([msg({ id: "1", role: "user", parts: [{ type: "text", text: long }] })]);
    expect(conversationTitle(c)).toBe(`${"x".repeat(48)}…`);
  });
});

describe("summarizeConversation", () => {
  it("derives id, title, updatedAt (last turn), and messageCount", () => {
    const c = conv(
      [
        msg({
          id: "1",
          role: "user",
          parts: [{ type: "text", text: "Query Delta" }],
          createdAt: 100,
        }),
        msg({ id: "2", role: "assistant", createdAt: 200 }),
      ],
      "conv-1",
    );
    expect(summarizeConversation(c)).toEqual({
      id: "conv-1",
      title: "Query Delta",
      updatedAt: 200,
      messageCount: 2,
    });
  });

  it("uses updatedAt 0 for an empty conversation", () => {
    expect(summarizeConversation(conv([], "empty")).updatedAt).toBe(0);
  });
});
