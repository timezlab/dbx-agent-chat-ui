import { z } from "zod";

export const globSchema = z.object({
  name: z.literal("glob"),
  args: z.object({
    pattern: z.string(),
    path: z.string().default("/"),
  }),
});
export type GlobCall = z.infer<typeof globSchema>;
