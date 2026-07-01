import { z } from "zod";

export const taskSchema = z.object({
  name: z.literal("task"),
  args: z.object({
    description: z.string(),
    /** phải là 1 trong các agent type đã cấu hình */
    subagent_type: z.string(),
  }),
});
export type TaskCall = z.infer<typeof taskSchema>;
