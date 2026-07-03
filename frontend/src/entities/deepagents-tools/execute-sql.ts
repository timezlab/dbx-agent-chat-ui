import { z } from "zod";

/**
 * SQL query tool — chạy truy vấn trên warehouse (ngữ cảnh Databricks). Args theo chữ ký
 * phổ biến: `query` bắt buộc, còn lại chọn warehouse/catalog/schema/limit. Output là BẢNG
 * `{ columns, rows }`, không phải string — render thành table card.
 */
export const executeSqlSchema = z.object({
  name: z.literal("execute_sql"),
  args: z.object({
    /** câu lệnh SQL cần chạy */
    query: z.string(),
    /** SQL warehouse chạy truy vấn (id/tên) */
    warehouse: z.string().nullish(),
    /** catalog mặc định cho truy vấn (Unity Catalog) */
    catalog: z.string().nullish(),
    /** schema mặc định cho truy vấn */
    schema: z.string().nullish(),
    /** giới hạn số dòng trả về */
    limit: z.number().int().nullish(),
  }),
});
export type ExecuteSqlCall = z.infer<typeof executeSqlSchema>;

/** Một ô: chuỗi, số hoặc null. */
export const sqlCellSchema = z.union([z.string(), z.number(), z.null()]);
/** Kết quả bảng của execute_sql (function_call_output). */
export const sqlResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(sqlCellSchema)),
  row_count: z.number().int().nullish(),
  truncated: z.boolean().nullish(),
});
export type SqlResult = z.infer<typeof sqlResultSchema>;