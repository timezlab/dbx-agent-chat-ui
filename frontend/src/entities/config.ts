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
  historyUrl: z.string().optional(), // NEXT_PUBLIC_HISTORY_API_URL; unset ⇒ history trống (không localStorage)
  feedbackUrl: z.string().optional(), // NEXT_PUBLIC_FEEDBACK_API_URL; unset ⇒ no-op
  agentsUrl: z.string().optional(), // NEXT_PUBLIC_AGENTS_API_URL; unset ⇒ ẩn selector
  // NEXT_PUBLIC_ME_API_URL — endpoint trả identity người dùng hiện tại (email + optional).
  // Optional; unset / fetch fail / thiếu email ⇒ ẩn chip identity. Chỉ để hiển thị.
  meUrl: z.string().optional(),
  // NEXT_PUBLIC_SAMPLE_PROMPTS (JSON array chuỗi) — gợi ý hiển thị ở empty-state.
  // Optional (như mọi field khác); unset/không hợp lệ ⇒ coi như [] tại nơi tiêu thụ.
  samplePrompts: z.array(z.string()).optional(),
  // NEXT_PUBLIC_ENABLE_UPLOAD — bật nút đính kèm ở composer. Optional; unset ⇒ false.
  uploadEnabled: z.boolean().optional(),
  // NEXT_PUBLIC_UPLOAD_ACCEPT (T071) — danh sách mime pattern/extension cho phép, phân
  // tách bởi dấu phẩy (vd "image/*,application/pdf,.csv"). Optional ở entity này (default
  // "image/*" áp dụng tại lib/config.ts#parseUploadAccept khi đọc từ env thật).
  uploadAccept: z.string().optional(),
  // NEXT_PUBLIC_UPLOAD_MAX_SIZE_MB (T071) — giới hạn dung lượng mỗi file, đơn vị MB.
  // Optional; default áp dụng tại lib/config.ts#parseUploadMaxSizeMb.
  uploadMaxSizeBytes: z.number().optional(),
  // NEXT_PUBLIC_DEV_TOOLS (FR-026) — bật entry Dev tools / Replay. Optional; unset ⇒
  // false (ẩn hoàn toàn). Non-secret selector (Principle II); parse tại
  // lib/config.ts#parseDevToolsEnabled.
  devToolsEnabled: z.boolean().optional(),
  // NEXT_PUBLIC_SHOW_USAGE — bật footer usage/metrics (time · TTFT · tokens · cost) mỗi
  // reply + run-time mỗi tool. Mặc định BẬT (khác các flag opt-in khác); chỉ tắt khi env
  // set "0"/"false"/"no"/"off". Parse tại lib/config.ts#parseShowUsage.
  usageEnabled: z.boolean().optional(),
  // NEXT_PUBLIC_CONTEXT_WINDOW — giới hạn context (tokens) meter đo occupancy khi backend
  // không gửi `context_window` mỗi lượt. Optional; default áp tại lib/config.ts#parseContextWindow.
  // Backend-reported (metrics.contextWindow) luôn thắng giá trị này (004).
  contextWindow: z.number().optional(),
  // NEXT_PUBLIC_DOCS_URL — URL cho tài liệu. Optional; unset ⇒ ẩn icon Docs ở sidebar.
  docsUrl: z.string().optional(),
  // NEXT_PUBLIC_WELCOME_URL — URL cho trang giới thiệu. Optional; unset ⇒ ẩn icon Welcome ở sidebar.
  welcomeUrl: z.string().optional(),
});
export type CapabilityConfig = z.infer<typeof CapabilityConfigSchema>;
