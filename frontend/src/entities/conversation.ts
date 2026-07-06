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
 * Hội thoại ở dạng LƯU TRỮ / trên wire — CHÍNH LÀ hợp đồng của `GET {historyUrl}/{id}`:
 * chỉ `id` + `messages` (các lượt đã thực sự gửi/nhận, cũ → mới). Đây là những gì backend
 * trả về và những gì "một hội thoại" thực sự là; KHÔNG chứa state runtime (`activeId`/
 * `queue`/`status`) — đó là chuyện của máy trạng thái streaming phía client (xem
 * `ChatSessionSchema`), backend không cần biết. `HistoryApiService.load` parse bằng schema
 * này.
 */
export const ConversationSchema = z.object({
  id: z.string(),
  messages: z.array(MessageSchema), // cũ → mới; chỉ lượt đã thực sự gửi/nhận
});
export type Conversation = z.infer<typeof ConversationSchema>;

/**
 * Phiên chat lúc RUNTIME (client-only, in-memory) = 1 `Conversation` + state của máy trạng
 * thái streaming: `activeId` (lượt assistant đang stream), `queue` (FIFO user chờ dispatch
 * khi đang stream — D6), `status`. Ba field này TRANSIENT, không bao giờ persist / không
 * có trên wire — nên chúng sống ở đây chứ không ở `ConversationSchema`. Chỉ reducer +
 * `useChat`/`useReplay` dùng type này; `lib/api` chỉ chạm tới `Conversation` (base).
 */
export const ChatSessionSchema = ConversationSchema.extend({
  activeId: z.string().nullable(), // id message assistant đang stream, else null
  queue: z.array(QueuedMessageSchema), // FIFO user chờ dispatch (D6); transient, không persist
  status: ConversationStatusSchema,
});
export type ChatSession = z.infer<typeof ChatSessionSchema>;

/**
 * Bọc 1 `Conversation` (base, vừa load từ history) thành 1 phiên runtime tinh khôi:
 * chưa stream (`activeId: null`), queue rỗng, `idle`. Đây là chỗ DUY NHẤT hai khái niệm
 * persisted ↔ runtime nối lại (khi mở 1 hội thoại cũ).
 */
export function toChatSession(base: Conversation): ChatSession {
  return { ...base, activeId: null, queue: [], status: "idle" };
}

/**
 * Lightweight row for the sidebar history list — enough to render + select a past
 * conversation without shipping every message. The full turns are fetched on demand
 * (`HistoryApiService.load(id)`) when the user opens one.
 */
export const ConversationSummarySchema = z.object({
  id: z.string(),
  title: z.string(), // dòng user đầu tiên (hoặc "New chat")
  updatedAt: z.number(), // epoch ms của lượt cuối; dùng để sắp xếp mới → cũ
  messageCount: z.number(), // số lượt đã gửi/nhận
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

/**
 * Trang lịch sử phân trang — backend trả về ĐÚNG shape này (snake_case theo contract
 * JSON của Databricks): `GET {historyUrl}?page&per_page` → `{ items, page, per_page, total }`
 * với `items` đã newest-first. Không transform ở client — schema khai báo CHÍNH LÀ hợp
 * đồng response. Mọi field có default để payload thiếu vẫn ra 1 trang dùng được thay vì
 * ném lỗi. Drives infinite-scroll của sidebar (fetch từng page 1).
 */
export const ConversationPageSchema = z.object({
  items: z.array(ConversationSummarySchema).default([]),
  page: z.number().int().positive().default(1),
  per_page: z.number().int().positive().default(20),
  total: z.number().int().nonnegative().default(0),
});
export type ConversationPage = z.infer<typeof ConversationPageSchema>;
