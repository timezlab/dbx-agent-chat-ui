import { z } from "zod";

/** Output là nội dung đánh số dòng kiểu cat -n (width 6, tab). */
export const readFileSchema = z.object({
  name: z.literal("read_file"),
  args: z.object({
    file_path: z.string(),
    offset: z.number().int().default(0),
    limit: z.number().int().default(100),
  }),
});
export type ReadFileCall = z.infer<typeof readFileSchema>;
