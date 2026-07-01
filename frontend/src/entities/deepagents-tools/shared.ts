/**
 * Sub-schema dùng chung cho các tool deepagents 0.4.12.
 * Nguồn: đọc source thật (filesystem.py · subagents.py · summarization.py · langchain todo.py).
 */

import { z } from "zod";

/** write_todos: status là enum 3 giá trị (todo.py:31). */
export const TodoStatusSchema = z.enum(["pending", "in_progress", "completed"]);
export type TodoStatus = z.infer<typeof TodoStatusSchema>;

export const TodoSchema = z.object({
  content: z.string(),
  status: TodoStatusSchema,
});
export type Todo = z.infer<typeof TodoSchema>;

/** grep output_mode (filesystem.py). */
export const GrepOutputModeSchema = z.enum(["files_with_matches", "content", "count"]);
export type GrepOutputMode = z.infer<typeof GrepOutputModeSchema>;

/**
 * Sự kiện compact TỰ ĐỘNG — KHÔNG phải tool.
 * SummarizationMiddleware tự nén khi vượt ngưỡng (mặc định fraction 0.85 context).
 */
export const SummarizationEventSchema = z.object({
  cutoff_index: z.number().int(),
  summary: z.string(),
  file_path: z.string().nullable(),
});
export type SummarizationEvent = z.infer<typeof SummarizationEventSchema>;
