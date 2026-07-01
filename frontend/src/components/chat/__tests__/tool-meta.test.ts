import { describe, expect, it } from "vitest";

import type { ToolActivityItem } from "@/entities";
import { isKnownTool, toolDisplay } from "@/components/chat/tool-meta";

function tool(over: Partial<ToolActivityItem>): ToolActivityItem {
  return {
    id: "c1",
    name: "read_file",
    args: {},
    detail: null,
    status: "done",
    ...over,
  };
}

describe("isKnownTool", () => {
  it("recognizes deepagents built-ins and rejects custom names", () => {
    expect(isKnownTool("write_todos")).toBe(true);
    expect(isKnownTool("grep")).toBe(true);
    expect(isKnownTool("my_custom_agent_tool")).toBe(false);
  });
});

describe("toolDisplay", () => {
  it("labels the first write_todos 'Create plan' and later ones 'Update plan'", () => {
    const item = tool({ name: "write_todos", args: { todos: [{ content: "x", status: "pending" }] } });
    expect(toolDisplay(item, { firstPlan: true }).title).toBe("Create plan");
    expect(toolDisplay(item, { firstPlan: false }).title).toBe("Update plan");
    expect(toolDisplay(item).title).toBe("Update plan");
  });

  it("humanizes built-ins with a verb + the primary arg as subtitle", () => {
    expect(toolDisplay(tool({ name: "read_file", args: { file_path: "a.ts" } }))).toMatchObject({
      title: "Read",
      subtitle: "a.ts",
      mono: true,
    });
    expect(toolDisplay(tool({ name: "grep", args: { pattern: "foo" } }))).toMatchObject({
      title: "Search",
      subtitle: "foo",
    });
  });

  it("falls back to the raw name + detail for custom tools", () => {
    const item = tool({ name: "weird_tool", args: { a: 1 }, detail: "some detail" });
    expect(toolDisplay(item)).toMatchObject({
      title: "weird_tool",
      subtitle: "some detail",
    });
  });
});
