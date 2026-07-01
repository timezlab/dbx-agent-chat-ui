import { z } from "zod";

export const writeFileSchema = z.object({
  name: z.literal("write_file"),
  args: z.object({
    file_path: z.string(),
    content: z.string(),
  }),
});
export type WriteFileCall = z.infer<typeof writeFileSchema>;
