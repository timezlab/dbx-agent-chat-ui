import { z } from "zod";

import { MessageSchema } from "./message";

/** Trạng thái phiên — suy ra từ activeId. */
export const ConversationStatusSchema = z.enum(["idle", "streaming"]);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

/**
 * Phiên hội thoại đang hoạt động (client-only, in-memory; persist qua HistoryProvider).
 * Tối đa 1 activeId; gửi khi đang stream ⇒ đẩy vào queue (FR-007, D6).
 */
export const ConversationSchema = z.object({
  id: z.string(),
  messages: z.array(MessageSchema), // cũ → mới
  activeId: z.string().nullable(), // id message assistant đang stream, else null
  queue: z.array(z.string()), // FIFO text user chờ dispatch (D6)
  status: ConversationStatusSchema,
});
export type Conversation = z.infer<typeof ConversationSchema>;
