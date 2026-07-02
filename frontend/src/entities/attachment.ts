import { z } from "zod";

/**
 * 1 file người dùng đính kèm vào message đang soạn (T071). Đọc client-side (FileReader
 * → base64), KHÔNG qua backend nào — đúng UI-only boundary. Cố tình không phân biệt
 * ảnh/PDF/file khác ở entity/UI layer (theo yêu cầu giữ đơn giản) — backend nào cần
 * hiểu định dạng gì thì tự parse `dataUrl`.
 * Session-only: `lib/history/local.ts` xoá `dataUrl` trước khi persist (không phát lại
 * byte file sau reload) — xem data-model note ở tasks.md T071.
 */
export const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number(), // bytes, file gốc (chưa base64)
  dataUrl: z.string(), // "data:<mime>;base64,<...>"; "" sau khi bị strip khỏi local history
});
export type Attachment = z.infer<typeof AttachmentSchema>;
