import { z } from "zod";

import { AttachmentSchema } from "./attachment";
import { FeedbackRatingSchema } from "./feedback";

/**
 * Feedback stored inline on an assistant turn (D10). Carries the full submission — the
 * up/down rating plus the optional free-text comment — so it round-trips through history
 * (persisted in `Conversation.messages[]`) instead of being lost after submit. `null` ⇒
 * no rating yet.
 */
export const MessageFeedbackSchema = z.object({
  rating: FeedbackRatingSchema, // "up" | "down"
  comment: z.string().optional(), // free-text; kept across a later rating-only re-submit
  submittedAt: z.number().optional(), // epoch ms of the last submit
});
export type MessageFeedback = z.infer<typeof MessageFeedbackSchema>;

/** Vai trò 1 turn hội thoại. */
export const MessageRoleSchema = z.enum(["user", "assistant"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

/**
 * Vòng đời message assistant (data-model.md).
 * queued → streaming → complete | stopped | error — các trạng thái cuối là idempotent.
 * User message tạo ra là 'complete' ngay; 'queued' áp cho pending-send trong hàng đợi.
 */
export const MessageStatusSchema = z.enum([
  "queued",
  "streaming",
  "complete",
  "stopped",
  "error",
]);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

/**
 * 1 lần agent dùng tool, hiển thị trên timeline (placeholder fidelity — feature 001).
 * `name` = raw tool id (classifier, exact-match deepagents, D12), không phải label.
 * `args` = structured args đã validate per-tool (xem entities/deepagents-tools), hoặc null.
 * Ghép start↔done qua `id` (= call_id).
 */
export const ToolActivityItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  args: z.record(z.string(), z.unknown()).nullable(),
  detail: z.string().nullable(),
  status: z.enum(["running", "done"]),
});
export type ToolActivityItem = z.infer<typeof ToolActivityItemSchema>;

/** 1 đoạn text liền mạch (markdown; lớn dần khi stream). */
export const TextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});
export type TextPart = z.infer<typeof TextPartSchema>;

/** 1 cụm tool-call liên tiếp — gộp để render 1 khối activity (gập được). */
export const ToolsPartSchema = z.object({
  type: z.literal("tools"),
  items: z.array(ToolActivityItemSchema),
});
export type ToolsPart = z.infer<typeof ToolsPartSchema>;

/**
 * 1 đoạn "thinking"/reasoning (Databricks reasoning models) — render khối gập, mặc định thu gọn.
 * Reasoning là kênh RIÊNG với text trả lời (không phải output_text). Trên wire Responses:
 * `response.reasoning_text.delta` (+ item.type "reasoning"); FM API: block content type "reasoning".
 * `signature`/`encrypted_content` là opaque ⇒ KHÔNG lưu ở đây. Xem docs/references/databricks-research.md.
 */
export const ReasoningPartSchema = z.object({
  type: z.literal("reasoning"),
  text: z.string(),
});
export type ReasoningPart = z.infer<typeof ReasoningPartSchema>;

/**
 * 1 phần của assistant message, giữ đúng thứ tự stream (text ↔ tool ↔ reasoning xen kẽ).
 * 1 turn có thể stream text nhiều đợt, chèn giữa là các cụm tool (xem recording rbg-performance-2026).
 * Reducer dựng thuần từ thứ tự event:
 *  - token     → nối vào `text` part cuối; nếu part cuối khác `text` thì mở `text` mới.
 *  - tool      → nối vào `tools` part cuối; nếu part cuối khác `tools` thì mở mới (ghép call↔output theo id).
 *  - reasoning → nối vào `reasoning` part cuối; nếu part cuối khác `reasoning` thì mở mới.
 *  - khi done: bỏ mọi `text`/`reasoning` part rỗng sau trim (vd đợt chỉ có 1 space).
 */
export const MessagePartSchema = z.discriminatedUnion("type", [
  TextPartSchema,
  ToolsPartSchema,
  ReasoningPartSchema,
]);
export type MessagePart = z.infer<typeof MessagePartSchema>;

/** 1 turn hội thoại. */
export const MessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  // user: [1 text part]; assistant: text↔tools xen kẽ theo thứ tự stream.
  // Gửi lại history (ChatRequest.content: string) ⇒ flatten nối các text part.
  parts: z.array(MessagePartSchema),
  // chỉ user message đính kèm (T071); assistant luôn []. Luôn là mảng (như `parts`),
  // không `.optional()`. Session-only: `lib/history/local.ts` xoá `dataUrl` trước khi
  // persist — sau reload chip vẫn hiện tên/dung lượng, không phát lại byte file.
  attachments: z.array(AttachmentSchema),
  status: MessageStatusSchema,
  error: z.string().nullable(), // chỉ assistant; set khi có error frame
  feedback: MessageFeedbackSchema.nullable(), // chỉ assistant; rating + comment đã lưu
  createdAt: z.number(), // thứ tự theo session (clock inject, không Date.now trong pure code)
});
export type Message = z.infer<typeof MessageSchema>;
