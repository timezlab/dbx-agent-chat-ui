/**
 * Slash-command registry (004). Commands are discoverability affordances over the ordinary
 * send path: running one just submits verbatim text (e.g. `/compact`) as a normal user turn —
 * the backend regex-recognizes it (see ADR request-context-ownership.md). No transport change.
 * Shared by the composer's compact button (US2) and the slash suggester popup (US3).
 */

/** Runtime state a command needs to decide availability + how to dispatch itself. */
export interface SlashCommandContext {
  /** Number of turns already in the conversation (some commands need a non-empty thread). */
  messageCount: number;
  /** Submit verbatim text as a normal user turn (the composer's send). */
  submit: (text: string) => void;
}

export interface SlashCommand {
  /** The literal command text, leading slash included (e.g. `/compact`). */
  name: string;
  /** One-line description shown in the suggester. */
  description: string;
  /** Whether the command is currently unavailable (still listed, but not runnable). */
  disabled?: (ctx: SlashCommandContext) => boolean;
  /** Execute the command. */
  run: (ctx: SlashCommandContext) => void;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "/compact",
    description: "Compact the conversation context to free up the window",
    // Nothing to compact on an empty thread.
    disabled: (ctx) => ctx.messageCount === 0,
    run: (ctx) => ctx.submit("/compact"),
  },
];

/**
 * Commands whose name starts with `prefix` (case-insensitive, trimmed). A prefix that is not
 * a slash-command (no leading `/`, or empty) matches nothing, so ordinary text never opens the
 * suggester. `"/"` alone lists every command.
 */
export function matchCommands(prefix: string): SlashCommand[] {
  const p = prefix.trim().toLowerCase();
  if (!p.startsWith("/")) return [];
  return SLASH_COMMANDS.filter((c) => c.name.toLowerCase().startsWith(p));
}
