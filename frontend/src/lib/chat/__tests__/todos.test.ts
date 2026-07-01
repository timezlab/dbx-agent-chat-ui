import { describe, expect, it } from "vitest";

import type { Message, ToolActivityItem } from "@/entities";
import { firstTodoWriteCallId, selectLatestTodos } from "@/lib/chat/todos";

function assistantWithTools(id: string, items: ToolActivityItem[]): Message {
  return {
    id,
    role: "assistant",
    parts: [{ type: "tools", items }],
    status: "complete",
    error: null,
    feedback: null,
    createdAt: 0,
  };
}

function writeTodos(
  callId: string,
  todos: { content: string; status: string }[],
): ToolActivityItem {
  return {
    id: callId,
    name: "write_todos",
    args: { todos },
    detail: null,
    status: "done",
  };
}

describe("selectLatestTodos", () => {
  it("returns [] when no plan was written", () => {
    const messages = [assistantWithTools("a", [])];
    expect(selectLatestTodos(messages)).toEqual([]);
  });

  it("returns the newest write_todos list (replace-whole-list)", () => {
    const messages = [
      assistantWithTools("a", [
        writeTodos("c1", [{ content: "one", status: "pending" }]),
      ]),
      assistantWithTools("b", [
        writeTodos("c2", [
          { content: "one", status: "completed" },
          { content: "two", status: "in_progress" },
        ]),
      ]),
    ];
    expect(selectLatestTodos(messages)).toEqual([
      { content: "one", status: "completed" },
      { content: "two", status: "in_progress" },
    ]);
  });
});

describe("firstTodoWriteCallId", () => {
  it("returns null when there is no plan write", () => {
    expect(firstTodoWriteCallId([assistantWithTools("a", [])])).toBeNull();
  });

  it("returns the id of the FIRST write_todos across the conversation", () => {
    const messages = [
      assistantWithTools("a", [
        {
          id: "read1",
          name: "read_file",
          args: { file_path: "x" },
          detail: null,
          status: "done",
        },
        writeTodos("plan1", [{ content: "one", status: "pending" }]),
      ]),
      assistantWithTools("b", [
        writeTodos("plan2", [{ content: "one", status: "completed" }]),
      ]),
    ];
    expect(firstTodoWriteCallId(messages)).toBe("plan1");
  });
});
