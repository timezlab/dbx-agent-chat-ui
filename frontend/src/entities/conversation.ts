import { z } from "zod";

import { AttachmentSchema } from "./attachment";
import { MessageSchema } from "./message";

/** Trạng thái phiên — suy ra từ activeId. */
export const ConversationStatusSchema = z.enum(["idle", "streaming"]);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

/**
 * 1 lượt user còn chờ trong hàng đợi gửi (D6), kèm attachments nếu có (T071).
 * `id` để render bubble "đang chờ" ổn định (key) — queue là buffer tạm, độc lập với
 * `messages` (chỉ chứa lượt đã thực sự gửi/nhận) và KHÔNG được persist.
 */
export const QueuedMessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  attachments: z.array(AttachmentSchema),
});
export type QueuedMessage = z.infer<typeof QueuedMessageSchema>;

/**
 * Phiên hội thoại đang hoạt động (client-only, in-memory; persist qua HistoryProvider).
 * Tối đa 1 activeId; gửi khi đang stream ⇒ đẩy vào queue (FR-007, D6).
 */
export const ConversationSchema = z.object({
  id: z.string(),
  messages: z.array(MessageSchema), // cũ → mới; chỉ lượt đã thực sự gửi/nhận
  activeId: z.string().nullable(), // id message assistant đang stream, else null
  queue: z.array(QueuedMessageSchema), // FIFO user chờ dispatch (D6); transient, không persist
  status: ConversationStatusSchema,
});
export type Conversation = z.infer<typeof ConversationSchema>;
