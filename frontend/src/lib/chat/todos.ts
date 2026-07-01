import { z } from "zod";

import { type Message, type Todo, TodoSchema } from "@/entities";

const TodosArraySchema = z.array(TodoSchema);

/**
 * Pick the agent's current plan: the `todos[]` from the NEWEST `write_todos` call
 * across the conversation. `write_todos` is replace-whole-list (no per-item id), so
 * the latest call IS the current state (see entities/deepagents-tools/write-todos).
 * Returns `[]` when the agent has not written a plan.
 */
export function selectLatestTodos(messages: Message[]): Todo[] {
  let latest: Todo[] = [];
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tools") continue;
      for (const item of part.items) {
        if (item.name !== "write_todos") continue;
        const raw = (item.args as { todos?: unknown } | null)?.todos;
        const parsed = TodosArraySchema.safeParse(raw);
        if (parsed.success) latest = parsed.data;
      }
    }
  }
  return latest;
}

/**
 * The `id` of the FIRST `write_todos` call in the conversation (stream order), or
 * null if none yet. Lets the UI label that one "Create plan" and every later plan
 * write "Update plan" (issue 6). Scans parts in order and returns the earliest.
 */
export function firstTodoWriteCallId(messages: Message[]): string | null {
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tools") continue;
      for (const item of part.items) {
        if (item.name === "write_todos") return item.id;
      }
    }
  }
  return null;
}

export default selectLatestTodos;
