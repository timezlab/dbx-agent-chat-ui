/**
 * Bản tham chiếu type thuần (KHÔNG zod) cho tool default của deepagents 0.4.12.
 * Nguồn chuẩn để validate là các *Schema zod; file này chỉ để tra nhanh/tham chiếu.
 */

/* ── Sub-types ── */
export type TodoStatus = "pending" | "in_progress" | "completed";
export interface Todo {
  content: string;
  status: TodoStatus;
}
export type GrepOutputMode = "files_with_matches" | "content" | "count";

/* ── Args từng tool (giữ nguyên arg keys gốc) ── */
export interface WriteTodosArgs {
  todos: Todo[]; // replace-whole-list (không có id, không update từng item)
}
export interface LsArgs {
  path: string; // absolute
}
export interface ReadFileArgs {
  file_path: string; // absolute
  offset: number; // default 0 (0-indexed)
  limit: number; // default 100
}
export interface WriteFileArgs {
  file_path: string;
  content: string;
}
export interface EditFileArgs {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all: boolean; // default false
}
export interface GlobArgs {
  pattern: string;
  path: string; // default "/"
}
export interface GrepArgs {
  pattern: string; // literal, không phải regex
  path?: string | null;
  glob?: string | null;
  output_mode: GrepOutputMode; // default "files_with_matches"
}
export interface ExecuteArgs {
  command: string;
  timeout?: number | null; // giây; 0 = no-timeout; ≤ 3600 (chỉ backend sandbox/local-shell)
}
export interface TaskArgs {
  description: string;
  subagent_type: string;
}
export type CompactConversationArgs = Record<string, never>; // {} — sự kiện START

/* compact_conversation — kết quả (sự kiện END, từ function_call_output) */
export interface CompactConversationResult {
  summary: string; // nội dung đã compact
  messagesBefore: number; // số message trước khi nén
  messagesAfter: number; // số message sau khi nén
}

/* ── Tool name + tool-call union (tag = name) ── */
export type DeepAgentsToolName =
  | "write_todos"
  | "ls"
  | "read_file"
  | "write_file"
  | "edit_file"
  | "glob"
  | "grep"
  | "execute"
  | "task"
  | "compact_conversation";

export type DeepAgentsToolCall =
  | { name: "write_todos"; args: WriteTodosArgs }
  | { name: "ls"; args: LsArgs }
  | { name: "read_file"; args: ReadFileArgs }
  | { name: "write_file"; args: WriteFileArgs }
  | { name: "edit_file"; args: EditFileArgs }
  | { name: "glob"; args: GlobArgs }
  | { name: "grep"; args: GrepArgs }
  | { name: "execute"; args: ExecuteArgs }
  | { name: "task"; args: TaskArgs }
  | { name: "compact_conversation"; args: CompactConversationArgs };

/* ── Sự kiện compact TỰ ĐỘNG (không phải tool) ── */
export interface SummarizationEvent {
  cutoff_index: number;
  summary: string;
  file_path: string | null;
}
