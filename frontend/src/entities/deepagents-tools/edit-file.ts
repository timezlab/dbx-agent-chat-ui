import { z } from "zod";

export const editFileSchema = z.object({
  name: z.literal("edit_file"),
  args: z.object({
    file_path: z.string(),
    old_string: z.string(),
    new_string: z.string(),
    replace_all: z.boolean().default(false),
  }),
});
export type EditFileCall = z.infer<typeof editFileSchema>;
