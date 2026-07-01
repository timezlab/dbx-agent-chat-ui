import { describe, expect, it } from "vitest";

import type { MessagePart, ToolActivityItem } from "@/entities";
import { groupMessageParts } from "@/lib/chat/message-parts";

function tool(id: string): ToolActivityItem {
  return { id, name: "grep", args: { pattern: "x" }, detail: null, status: "done" };
}

const text = (t: string): MessagePart => ({ type: "text", text: t });
const reasoning = (t: string): MessagePart => ({ type: "reasoning", text: t });
const tools = (...ids: string[]): MessagePart => ({
  type: "tools",
  items: ids.map(tool),
});

describe("groupMessageParts", () => {
  it("returns an empty list for no parts", () => {
    expect(groupMessageParts([])).toEqual([]);
  });

  it("folds a consecutive reasoning+tools run into one activity segment", () => {
    const segments = groupMessageParts([
      reasoning("thinking"),
      tools("a"),
      tools("b"),
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ kind: "activity", index: 0 });
    expect(segments[0].kind === "activity" && segments[0].parts).toHaveLength(3);
  });

  it("keeps text standalone and splits activity around it (index = start part)", () => {
    const parts = [
      reasoning("plan"),
      tools("a"),
      text("answer"),
      tools("b"),
    ];
    const segments = groupMessageParts(parts);
    expect(segments.map((s) => s.kind)).toEqual(["activity", "text", "activity"]);
    expect(segments.map((s) => s.index)).toEqual([0, 2, 3]);
  });

  it("does not merge across a text part", () => {
    const segments = groupMessageParts([tools("a"), text("hi"), tools("b")]);
    const activityCounts = segments
      .filter((s) => s.kind === "activity")
      .map((s) => (s.kind === "activity" ? s.parts.length : 0));
    expect(activityCounts).toEqual([1, 1]);
  });
});
