import { describe, expect, it } from "vitest";

import type { Conversation, MessagePart } from "@/entities";
import { reduceStreamEvent } from "@/lib/chat/reducer";

function active(parts: MessagePart[] = []): Conversation {
  return {
    id: "c",
    messages: [
      {
        id: "a",
        role: "assistant",
        parts,
        attachments: [],
        status: "streaming",
        error: null,
        feedback: null,
        createdAt: 0,
      },
    ],
    activeId: "a",
    queue: [],
    status: "streaming",
  };
}

describe("reduceStreamEvent — tools & error (US3)", () => {
  it("interleaves text ↔ tools by event order (multi-burst timeline)", () => {
    let c = active();
    c = reduceStreamEvent(c, { type: "token", delta: "Let me check." });
    c = reduceStreamEvent(c, {
      type: "tool",
      id: "call_1",
      name: "read_file",
      args: { file_path: "a.ts" },
      status: "running",
    });
    c = reduceStreamEvent(c, { type: "token", delta: "Found it." });

    const parts = c.messages[0].parts;
    expect(parts.map((p) => p.type)).toEqual(["text", "tools", "text"]);
    expect(parts[1]).toMatchObject({
      type: "tools",
      items: [{ id: "call_1", name: "read_file", status: "running" }],
    });
    expect(parts[2]).toEqual({ type: "text", text: "Found it." });
  });

  it("upserts a tool item by call_id (running → done merges into one)", () => {
    let c = active();
    c = reduceStreamEvent(c, {
      type: "tool",
      id: "call_1",
      name: "read_file",
      args: { file_path: "a.ts" },
      status: "running",
    });
    c = reduceStreamEvent(c, {
      type: "tool",
      id: "call_1",
      name: "read_file",
      detail: "contents",
      status: "done",
    });

    const tools = c.messages[0].parts[0];
    expect(tools.type).toBe("tools");
    if (tools.type !== "tools") throw new Error("expected tools part");
    expect(tools.items).toHaveLength(1);
    expect(tools.items[0]).toMatchObject({
      id: "call_1",
      status: "done",
      detail: "contents",
      args: { file_path: "a.ts" },
    });
  });

  it("error frame sets status error, keeps partial parts, clears active", () => {
    let c = active([{ type: "text", text: "partial" }]);
    c = reduceStreamEvent(c, { type: "error", message: "upstream failed" });

    expect(c.messages[0].status).toBe("error");
    expect(c.messages[0].error).toBe("upstream failed");
    expect(c.messages[0].parts).toEqual([{ type: "text", text: "partial" }]);
    expect(c.activeId).toBeNull();
    expect(c.status).toBe("idle");
  });
});
