import { describe, expect, it, vi } from "vitest";

import {
  matchCommands,
  SLASH_COMMANDS,
  type SlashCommandContext,
} from "@/lib/chat/slash-commands";

const ctx = (over: Partial<SlashCommandContext> = {}): SlashCommandContext => ({
  messageCount: 2,
  submit: vi.fn(),
  ...over,
});

describe("slash-commands (US2/US3)", () => {
  it("matches by prefix", () => {
    expect(matchCommands("/co").map((c) => c.name)).toEqual(["/compact"]);
    expect(matchCommands("/").map((c) => c.name)).toContain("/compact");
  });

  it("returns nothing for non-command / non-matching input", () => {
    expect(matchCommands("hi")).toEqual([]);
    expect(matchCommands("/zzz")).toEqual([]);
    expect(matchCommands("")).toEqual([]);
  });

  it("marks /compact disabled on an empty conversation", () => {
    const compact = SLASH_COMMANDS.find((c) => c.name === "/compact")!;
    expect(compact.disabled?.(ctx({ messageCount: 0 }))).toBe(true);
    expect(compact.disabled?.(ctx({ messageCount: 3 }))).toBe(false);
  });

  it("runs /compact by submitting the verbatim command text", () => {
    const submit = vi.fn();
    const compact = SLASH_COMMANDS.find((c) => c.name === "/compact")!;
    compact.run(ctx({ submit }));
    expect(submit).toHaveBeenCalledWith("/compact");
  });
});
