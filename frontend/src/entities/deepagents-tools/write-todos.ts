import { z } from "zod";
import { TodoSchema } from "./shared";

/**
 * write_todos vừa TẠO vừa CẬP NHẬT — KHÔNG có tool `update_todos` riêng.
 * "Update" = gọi lại với TOÀN BỘ list (Todo không có id ⇒ replace-whole-list).
 * UI: gộp các lần gọi liên tiếp thành 1 checklist, lấy list ở lần mới nhất.
 */
export const writeTodosSchema = z.object({
  name: z.literal("write_todos"),
  args: z.object({
    todos: z.array(TodoSchema),
  }),
});
export type WriteTodosCall = z.infer<typeof writeTodosSchema>;
