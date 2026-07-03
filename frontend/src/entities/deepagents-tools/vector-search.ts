import { z } from "zod";

/**
 * Vector search / retrieval tool (RAG) — tra cứu ngữ nghĩa trên một index. Args theo chữ ký
 * Databricks Vector Search. Output là MẢNG chunk `{ content, source?, score? }`, không phải
 * string — render thành list chunk card.
 */
export const vectorSearchSchema = z.object({
  name: z.literal("vector_search"),
  args: z.object({
    /** câu truy vấn ngữ nghĩa cần tra */
    query: z.string(),
    /** số chunk trả về (top-k); backend tự chốt mặc định nếu bỏ trống */
    num_results: z.number().int().nullish(),
    /** tên index cần tra, ví dụ "catalog.schema.my_index" — xác định kho tri thức */
    index: z.string().nullish(),
    /** cột muốn lấy về từ index, ví dụ ["id","text","url"] */
    columns: z.array(z.string()).nullish(),
  }),
});
export type VectorSearchCall = z.infer<typeof vectorSearchSchema>;

/** Một chunk trả về: nội dung + nguồn + điểm tương đồng. */
export const retrievalChunkSchema = z.object({
  /** đoạn văn bản khớp */
  content: z.string(),
  /** nguồn của chunk (đường dẫn file / URL / id tài liệu) */
  source: z.string().nullish(),
  /** điểm tương đồng (càng cao càng khớp) */
  score: z.number().nullish(),
});
export const retrievalResultsSchema = z.array(retrievalChunkSchema);
export type RetrievalChunk = z.infer<typeof retrievalChunkSchema>;