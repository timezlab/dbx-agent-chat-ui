import { z } from "zod";

/**
 * Web search tool — không phải filesystem built-in, nhưng là tool phổ biến nhất được
 * gắn thêm vào agent deepagents (kiểu Tavily `internet_search`). Coi như default vì gần
 * như agent nào cũng có. Args giữ theo chữ ký Tavily: `query` bắt buộc, còn lại tuỳ chọn.
 */
export const webSearchSchema = z.object({
  name: z.literal("web_search"),
  args: z.object({
    query: z.string(),
    /** số kết quả tối đa; backend tự chốt mặc định (Tavily = 5) */
    max_results: z.number().int().nullish(),
    /** nguồn cần tra — mảng để cover cả Tavily ("news"/"general") lẫn Firecrawl ("web"/"news"/…) */
    sources: z.array(z.string()).nullish(),
    /** thiên vị theo địa lý, ví dụ "US" | "Vietnam" */
    location: z.string().nullish(),
    /** khoảng thời gian (ISO date, ví dụ "2026-01-01") */
    start_date: z.string().nullish(),
    end_date: z.string().nullish(),
  }),
});
export type WebSearchCall = z.infer<typeof webSearchSchema>;

/**
 * Kết quả trả về (function_call_output): mảng object, KHÔNG phải 1 string. Mỗi nguồn có
 * `url` bắt buộc; `title`/`preview` tuỳ backend (Tavily = title+content, Firecrawl = title+description).
 */
export const webSearchResultSchema = z.object({
  url: z.string(),
  title: z.string().nullish(),
  preview: z.string().nullish(),
});
export const webSearchResultsSchema = z.array(webSearchResultSchema);
export type WebSearchResult = z.infer<typeof webSearchResultSchema>;
