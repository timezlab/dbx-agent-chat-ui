import { z } from "zod";

import { AttachmentSchema } from "./attachment";
import { MessageRoleSchema } from "./message";

/**
 * Data model cho transport (neutral, backend-agnostic — contracts/chat-transport.md).
 * Đây là ENTITY (schema + type). Port hành vi `ChatTransport`/`ChatStreamHandlers`
 * + `resolveTransport` sống ở `lib/chat/transport.ts`, KHÔNG ở đây.
 * Adapter thật MAP frame vendor (Databricks Responses) → `ChatStreamEvent` (D3).
 */

/** 1 lượt trong history gửi lên backend (assistant text đã flatten từ parts). */
export const ChatRequestMessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
  // Chỉ có mặt trên lượt ĐANG gửi (T071) — history cũ replay lại KHÔNG kèm attachments,
  // tránh payload phình theo cấp số nhân mỗi lượt (xem databricks-research.md, giới hạn
  // 16 MB/request của Model Serving).
  attachments: z.array(AttachmentSchema).optional(),
});
export type ChatRequestMessage = z.infer<typeof ChatRequestMessageSchema>;

/** Request 1 lần generate. */
export const ChatRequestSchema = z.object({
  messages: z.array(ChatRequestMessageSchema), // full history cũ → mới
  agentId: z.string().optional(), // chỉ khi có agents API + đã chọn
  conversationId: z.string().optional(), // cho backend correlate theo hội thoại
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
