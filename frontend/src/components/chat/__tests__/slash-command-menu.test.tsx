import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SlashCommandMenu } from "@/components/chat/slash-command-menu";
import {
  SLASH_COMMANDS,
  type SlashCommandContext,
} from "@/lib/chat/slash-commands";

const ctx = (over: Partial<SlashCommandContext> = {}): SlashCommandContext => ({
  messageCount: 2,
  submit: vi.fn(),
  ...over,
});

describe("SlashCommandMenu (US3)", () => {
  it("lists each command's name + description", () => {
    render(
      <SlashCommandMenu
        commands={SLASH_COMMANDS}
        activeIndex={0}
        context={ctx()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("/compact")).toBeInTheDocument();
    expect(screen.getByText(/optionally add guidance/i)).toBeInTheDocument();
  });

  it("marks the active item as selected", () => {
    render(
      <SlashCommandMenu
        commands={SLASH_COMMANDS}
        activeIndex={0}
        context={ctx()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("option", { name: /compact/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("selects a command on click", () => {
    const onSelect = vi.fn();
    render(
      <SlashCommandMenu
        commands={SLASH_COMMANDS}
        activeIndex={0}
        context={ctx()}
        onSelect={onSelect}
      />,
    );
    fireEvent.mouseDown(screen.getByRole("option", { name: /compact/i }));
    expect(onSelect).toHaveBeenCalledWith(SLASH_COMMANDS[0]);
  });
});
