import { z } from "zod";

/**
 * Web fetch tool — lấy nội dung một URL cụ thể (đọc/scrape trang), đi cặp với web_search.
 * Args theo chữ ký phổ biến: `url` bắt buộc, `max_length`/`format` tuỳ backend
 * (Anthropic web_fetch = url; Firecrawl scrape = url + formats). Output là nội dung trang
 * (một chuỗi text/markdown), KHÔNG phải mảng như web_search.
 */
export const webFetchSchema = z.object({
  name: z.literal("web_fetch"),
  args: z.object({
    url: z.string(),
    /** cắt bớt nội dung ở N ký tự */
    max_length: z.number().int().nullish(),
    /** định dạng trả về, ví dụ "markdown" | "text" | "html" */
    format: z.string().nullish(),
  }),
});
export type WebFetchCall = z.infer<typeof webFetchSchema>;
