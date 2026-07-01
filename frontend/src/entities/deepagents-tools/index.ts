/**
 * Registry + validate cho tool deepagents 0.4.12.
 *
 * Mỗi tool = 1 schema `z.object({ name: z.literal(...), args: z.object({...}) })` ở file riêng.
 * Nhét thẳng event `{ name, args }` vào schema (hoặc union) là parse + narrow được ngay.
 */

import { z } from "zod";

import { writeTodosSchema } from "./write-todos";
import { lsSchema } from "./ls";
import { readFileSchema } from "./read-file";
import { writeFileSchema } from "./write-file";
import { editFileSchema } from "./edit-file";
import { globSchema } from "./glob";
import { grepSchema } from "./grep";
import { executeSchema } from "./execute";
import { taskSchema } from "./task";
import { compactConversationSchema } from "./compact-conversation";

// Re-export để import 1 chỗ.
export * from "./shared";
export * from "./write-todos";
export * from "./ls";
export * from "./read-file";
export * from "./write-file";
export * from "./edit-file";
export * from "./glob";
export * from "./grep";
export * from "./execute";
export * from "./task";
export * from "./compact-conversation";

/** name → schema (exact-match). Dùng khi biết trước name muốn validate. */
export const DEEPAGENTS_TOOL_SCHEMAS = {
  write_todos: writeTodosSchema,
  ls: lsSchema,
  read_file: readFileSchema,
  write_file: writeFileSchema,
  edit_file: editFileSchema,
  glob: globSchema,
  grep: grepSchema,
  execute: executeSchema,
  task: taskSchema,
  compact_conversation: compactConversationSchema,
} as const;

export type DeepAgentsToolName = keyof typeof DEEPAGENTS_TOOL_SCHEMAS;

export function isDeepAgentsTool(name: string): name is DeepAgentsToolName {
  return name in DEEPAGENTS_TOOL_SCHEMAS;
}

/** Union theo `name`: parse ra là narrow đúng nhánh (args đúng kiểu, không cần cast). */
export const DeepAgentsToolCallSchema = z.discriminatedUnion("name", [
  writeTodosSchema,
  lsSchema,
  readFileSchema,
  writeFileSchema,
  editFileSchema,
  globSchema,
  grepSchema,
  executeSchema,
  taskSchema,
  compactConversationSchema,
]);
export type DeepAgentsToolCall = z.infer<typeof DeepAgentsToolCallSchema>;

/**
 * Dùng KHI BẮT SSE: đưa `item.name` + `item.arguments` (JSON string hoặc object đã parse).
 * @returns call đã validate (narrow theo name) | null nếu custom/unknown hoặc args sai.
 */
export function parseToolCall(name: string, rawArgs: unknown): DeepAgentsToolCall | null {
  const args = typeof rawArgs === "string" ? safeJson(rawArgs) : rawArgs;
  const parsed = DeepAgentsToolCallSchema.safeParse({ name, args });
  return parsed.success ? parsed.data : null;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
