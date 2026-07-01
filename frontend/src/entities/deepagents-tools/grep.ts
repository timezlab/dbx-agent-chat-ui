import { z } from "zod";
import { GrepOutputModeSchema } from "./shared";

export const grepSchema = z.object({
  name: z.literal("grep"),
  args: z.object({
    /** literal string, KHÔNG phải regex */
    pattern: z.string(),
    path: z.string().nullish(),
    glob: z.string().nullish(),
    output_mode: GrepOutputModeSchema.default("files_with_matches"),
  }),
});
export type GrepCall = z.infer<typeof grepSchema>;
