import { z } from "zod";

import { AttachmentSchema } from "./attachment";

/**
 * Data model cho transport (neutral, backend-agnostic — contracts/chat-transport.md).
 * Đây là ENTITY (schema + type). Port hành vi `ChatTransport`/`ChatStreamHandlers`
 * + `resolveTransport` sống ở `lib/chat/transport.ts`, KHÔNG ở đây.
 * Adapter thật MAP frame vendor (Databricks Responses) → `ChatStreamEvent` (D3).
 */

/**
 * Request 1 lần generate — THIN REQUEST (004): chỉ mang lượt user HIỆN TẠI (`query`),
 * KHÔNG gửi lại lịch sử. Backend sở hữu Checkpoint tích luỹ theo `conversationId`; gửi
 * lại history sẽ tái phồng context và vô hiệu hoá /compact. Lịch sử hiển thị/reload nằm ở
 * bảng Databricks (đọc qua History API), tách khỏi Checkpoint. Xem ADR
 * `request-context-ownership.md`.
 */
export const ChatRequestSchema = z.object({
  query: z.string(), // nội dung lượt user hiện tại (thin request)
  // File đính kèm CỦA LƯỢT NÀY (T071). Optional; tránh payload phình — không kèm history.
  attachments: z.array(AttachmentSchema).optional(),
  agentId: z.string().optional(), // chỉ khi có agents API + đã chọn
  conversationId: z.string().optional(), // khoá Checkpoint + correlate hội thoại ở backend
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/**
 * Event stream trung lập reducer tiêu thụ.
 * - token     → nối text.
 * - reasoning → kênh "thinking" (Databricks reasoning models), tách khỏi token.
 * - tool      → hoạt động tool; mang raw `name` + `args` đã parse (D12), ghép start↔end theo `id`.
 *               `durationMs` (optional) = thời gian chạy tool, do backend gửi trên frame kết thúc.
 * - usage     → số liệu token/cost 1 lượt (do backend gửi, `response.completed`); KHÔNG terminal,
 *               reducer gắn vào assistant message cuối. Thiếu frame ⇒ đơn giản là không có số.
 * - error / done → terminal.
 */
export const ChatStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("token"), delta: z.string() }),
  z.object({ type: z.literal("reasoning"), delta: z.string() }),
  z.object({
    type: z.literal("tool"),
    id: z.string(),
    name: z.string(),
    args: z.record(z.string(), z.unknown()).nullish(),
    detail: z.string().optional(),
    status: z.enum(["running", "done"]),
    durationMs: z.number().optional(),
  }),
  z.object({
    type: z.literal("usage"),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    totalTokens: z.number().optional(),
    costUsd: z.number().optional(),
    durationMs: z.number().optional(),
    ttftMs: z.number().optional(),
    // Backend Checkpoint size limit (wire snake_case `context_window`/`max_tokens` →
    // camelCase here). Feeds the context-window meter (004); optional.
    contextWindow: z.number().optional(),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("done") }),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
