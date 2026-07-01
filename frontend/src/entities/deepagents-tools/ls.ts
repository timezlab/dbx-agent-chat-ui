import { z } from "zod";

export const lsSchema = z.object({
  name: z.literal("ls"),
  args: z.object({
    path: z.string(),
  }),
});
export type LsCall = z.infer<typeof lsSchema>;
