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
    expect(isKnownTool("web_search")).toBe(true);
    expect(isKnownTool("web_fetch")).toBe(true);
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
    expect(
      toolDisplay(tool({ name: "web_search", args: { query: "SaaS market 2026" } })),
    ).toMatchObject({ title: "Search web", subtitle: "SaaS market 2026", mono: false });
    expect(
      toolDisplay(tool({ name: "web_fetch", args: { url: "https://example.com/a" } })),
    ).toMatchObject({ title: "Fetch", subtitle: "https://example.com/a", mono: true });
  });

  it("presents a read_file under /skills/ as a Skill; SKILL.md shows just the name", () => {
    // Reading a skill's own SKILL.md IS activating it → name only, no file.
    expect(
      toolDisplay(tool({ name: "read_file", args: { file_path: "/skills/report-builder/SKILL.md" } })),
    ).toMatchObject({ title: "Skill", subtitle: "report-builder" });
    // A supporting asset shows the skill name + the file basename (not the nested dir).
    expect(
      toolDisplay(
        tool({ name: "read_file", args: { file_path: "/skills/report-builder/assets/layout-css.md" } }),
      ).subtitle,
    ).toBe("report-builder - layout-css.md");
  });

  it("shows just the skill name when a /skills/ path has no file segment", () => {
    expect(
      toolDisplay(tool({ name: "read_file", args: { file_path: "/skills/financial-analysis" } })).subtitle,
    ).toBe("financial-analysis");
    expect(
      toolDisplay(tool({ name: "read_file", args: { file_path: "/skills/financial-analysis/" } })).subtitle,
    ).toBe("financial-analysis");
  });

  it("keeps a normal (non-/skills/) read_file as a plain Read of the path", () => {
    expect(
      toolDisplay(tool({ name: "read_file", args: { file_path: "/repo/skills.ts" } })),
    ).toMatchObject({ title: "Read", subtitle: "/repo/skills.ts" });
  });

  it("falls back to the raw name + detail for custom tools", () => {
    const item = tool({ name: "weird_tool", args: { a: 1 }, detail: "some detail" });
    expect(toolDisplay(item)).toMatchObject({
      title: "weird_tool",
      subtitle: "some detail",
    });
  });
});
