import { z } from "zod";

/**
 * View có kiểu của public config (đọc từ env.ts qua lib/config.ts).
 * KHÔNG có "transport mode": FE luôn stream 1 endpoint theo format Databricks Playground.
 * Mỗi URL độc lập & optional (D8). KHÔNG bao giờ chứa secret — chỉ NEXT_PUBLIC_* (Principle II).
 */
export const CapabilityConfigSchema = z.object({
  // NEXT_PUBLIC_CHAT_ENDPOINT_URL — endpoint chat DUY NHẤT (Databricks Playground format).
  // Local dev: trỏ vào mock-api script. Thiếu ⇒ UI hiện thông báo inline (T055).
  chatEndpointUrl: z.string().optional(),
  historyUrl: z.string().optional(), // NEXT_PUBLIC_HISTORY_API_URL; unset ⇒ localStorage
  feedbackUrl: z.string().optional(), // NEXT_PUBLIC_FEEDBACK_API_URL; unset ⇒ mock sink
  agentsUrl: z.string().optional(), // NEXT_PUBLIC_AGENTS_API_URL; unset ⇒ ẩn selector
  // NEXT_PUBLIC_SAMPLE_PROMPTS (JSON array chuỗi) — gợi ý hiển thị ở empty-state.
  // Optional (như mọi field khác); unset/không hợp lệ ⇒ coi như [] tại nơi tiêu thụ.
  samplePrompts: z.array(z.string()).optional(),
  // NEXT_PUBLIC_ENABLE_UPLOAD — bật nút đính kèm ở composer. Optional; unset ⇒ false
  // (upload vẫn deferred: khi bật chỉ là affordance, chưa xử lý file).
  uploadEnabled: z.boolean().optional(),
});
export type CapabilityConfig = z.infer<typeof CapabilityConfigSchema>;
