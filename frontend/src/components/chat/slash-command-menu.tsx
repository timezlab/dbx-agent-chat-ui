"use client";

import { FoldVerticalIcon, SlashIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SlashCommand, SlashCommandContext } from "@/lib/chat/slash-commands";

export interface SlashCommandMenuProps {
  /** Commands to list (already prefix-filtered by the caller). */
  commands: SlashCommand[];
  /** Index of the keyboard-highlighted command. */
  activeIndex: number;
  /** Runtime state used to decide per-command availability. */
  context: SlashCommandContext;
  /** Run a command (click / mouse). Keyboard selection is handled by the composer. */
  onSelect: (command: SlashCommand) => void;
  className?: string;
}

/** Per-command leading glyph — kept in the UI layer so the registry stays framework-agnostic. */
const COMMAND_ICONS: Record<string, LucideIcon> = {
  "/compact": FoldVerticalIcon,
};

/**
 * The slash-command suggester popup (US3): a compact mention-style listbox anchored above the
 * composer input, styled after common command-palette / @-mention menus (leading glyph, name +
 * description, an ⏎ hint on the active row). Presentational only — the composer owns the open
 * state, filtering, and keyboard navigation (focus stays in the textarea); this renders and
 * forwards mouse selection.
 */
export function SlashCommandMenu({
  commands,
  activeIndex,
  context,
  onSelect,
  className,
}: SlashCommandMenuProps) {
  if (commands.length === 0) return null;

  return (
    <div
      data-slot="slash-command-menu"
      role="listbox"
      aria-label="Slash commands"
      className={cn(
        "absolute bottom-full left-0 z-50 mb-1.5 w-max min-w-60 max-w-sm",
        "overflow-hidden rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground",
        "shadow-lg ring-1 ring-black/2 animate-in fade-in-0 slide-in-from-bottom-1 duration-150",
        className,
      )}
    >
      <div className="px-2 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
        Commands
      </div>
      {commands.map((command, i) => {
        const disabled = command.disabled?.(context) ?? false;
        const active = i === activeIndex;
        const Icon = COMMAND_ICONS[command.name] ?? SlashIcon;
        return (
          <button
            key={command.name}
            type="button"
            role="option"
            aria-selected={active}
            data-active={active}
            disabled={disabled}
            // mousedown (not click) so selecting does not blur the textarea first.
            onMouseDown={(e) => {
              e.preventDefault();
              if (!disabled) onSelect(command);
            }}
            className={cn(
              "group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
              active ? "bg-accent" : "hover:bg-accent/50",
              disabled && "opacity-50",
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-muted-foreground",
                active && "border-transparent bg-background text-foreground",
              )}
            >
              <Icon className="size-3" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] font-medium leading-tight tabular-nums">
                {command.name}
              </span>
              <span className="truncate text-[11px] leading-tight text-muted-foreground">
                {command.description}
              </span>
            </span>
            {active ? (
              <kbd className="ml-auto hidden shrink-0 rounded border border-border/70 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                ⇥ Tab
              </kbd>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default SlashCommandMenu;
