import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  BrainIcon,
  FilePenIcon,
  FileTextIcon,
  FolderIcon,
  ListTodoIcon,
  PuzzleIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";

import type { ToolActivityItem } from "@/entities";

/**
 * How one tool call presents in the timeline. Icons are the ONLY differentiator —
 * color stays neutral so the single locked accent (indigo) is reserved for
 * state (running/primary), not per-tool rainbow (design-taste color-lock).
 */
export interface ToolDisplay {
  icon: ComponentType<LucideProps>;
  /** short verb, e.g. "Read", "Run", "Search". */
  title: string;
  /** optional secondary detail (path / command / pattern); truncated by the row. */
  subtitle: string | null;
  /** render the subtitle in a monospace face (paths, commands, patterns). */
  mono: boolean;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * A `read_file` under `/skills/<name>/…` isn't a plain file read — the agent is
 * pulling in a skill. Recognize that path shape and label it as such: the skill
 * name (segment after `/skills/`). Reading the skill's own `SKILL.md` IS the skill
 * (activation), so show only the name; a supporting asset appends its basename
 * (`name - file`, nested `assets/` dir dropped as noise). Returns null for
 * non-skill paths so the caller keeps the ordinary "Read <path>" presentation.
 */
export function skillSubtitle(filePath: string | null): string | null {
  if (!filePath) return null;
  const match = /^\/skills\/([^/]+)(?:\/(.*))?$/.exec(filePath);
  if (!match) return null;
  const [, name, rest] = match;
  const file = rest?.split("/").filter(Boolean).pop();
  return file && file !== "SKILL.md" ? `${name} - ${file}` : name;
}

/** deepagents built-in tools we render with a bespoke, humanized body (issue 5). */
const KNOWN_TOOLS = new Set([
  "write_todos",
  "ls",
  "read_file",
  "write_file",
  "edit_file",
  "glob",
  "grep",
  "execute",
  "task",
  "compact_conversation",
]);

/** A default (built-in) tool gets a tailored body; anything else keeps raw args. */
export function isKnownTool(name: string): boolean {
  return KNOWN_TOOLS.has(name);
}

export interface ToolDisplayOptions {
  /** This call is the first `write_todos` of the conversation → "Create plan". */
  firstPlan?: boolean;
}

/**
 * Derive `{ icon, title, subtitle }` from a tool call, reading the validated
 * deepagents args (`ToolActivityItem.args`) so the label is human, not raw JSON.
 * Unknown/custom tools fall back to the raw name + `detail`.
 */
export function toolDisplay(
  item: ToolActivityItem,
  options: ToolDisplayOptions = {},
): ToolDisplay {
  const args = (item.args ?? {}) as Record<string, unknown>;
  switch (item.name) {
    case "write_todos": {
      const n = Array.isArray(args.todos) ? args.todos.length : 0;
      return {
        icon: ListTodoIcon,
        // The plan is born on the first write; every later write revises it.
        title: options.firstPlan ? "Create plan" : "Update plan",
        subtitle: n ? `${n} ${n === 1 ? "task" : "tasks"}` : null,
        mono: false,
      };
    }
    case "ls":
      return { icon: FolderIcon, title: "List", subtitle: str(args.path), mono: true };
    case "read_file": {
      const filePath = str(args.file_path);
      const skill = skillSubtitle(filePath);
      if (skill) {
        return { icon: PuzzleIcon, title: "Skill", subtitle: skill, mono: false };
      }
      return { icon: FileTextIcon, title: "Read", subtitle: filePath, mono: true };
    }
    case "write_file":
      return {
        icon: FilePenIcon,
        title: "Write",
        subtitle: str(args.file_path),
        mono: true,
      };
    case "edit_file":
      return {
        icon: FilePenIcon,
        title: "Edit",
        subtitle: str(args.file_path),
        mono: true,
      };
    case "glob":
      return { icon: SearchIcon, title: "Find", subtitle: str(args.pattern), mono: true };
    case "grep":
      return {
        icon: SearchIcon,
        title: "Search",
        subtitle: str(args.pattern),
        mono: true,
      };
    case "execute":
      return {
        icon: TerminalIcon,
        title: "Run",
        subtitle: str(args.command),
        mono: true,
      };
    case "task":
      return {
        icon: SparklesIcon,
        title: "Delegate",
        subtitle: str(args.description),
        mono: false,
      };
    case "compact_conversation":
      return { icon: BrainIcon, title: "Compact conversation", subtitle: null, mono: false };
    default:
      return {
        icon: WrenchIcon,
        title: item.name,
        subtitle: item.detail,
        mono: false,
      };
  }
}

export default toolDisplay;
