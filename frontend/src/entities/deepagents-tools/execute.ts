import { z } from "zod";

/** Chỉ tồn tại trên backend hỗ trợ thực thi (sandbox/local-shell). */
export const executeSchema = z.object({
  name: z.literal("execute"),
  args: z.object({
    command: z.string(),
    /** giây; 0 = no-timeout (nếu backend hỗ trợ); ≤ max_execute_timeout (mặc định 3600) */
    timeout: z.number().int().nullish(),
  }),
});
export type ExecuteCall = z.infer<typeof executeSchema>;
