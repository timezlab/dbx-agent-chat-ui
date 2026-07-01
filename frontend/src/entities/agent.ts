import { z } from "zod";

/** 1 agent backend chọn được (fetch từ agents API). */
export const AgentSchema = z.object({
  id: z.string(), // gửi trong ChatRequest.agentId
  name: z.string(), // label hiển thị trong selector
});
export type Agent = z.infer<typeof AgentSchema>;

/** Trạng thái chọn agent. */
export const AgentSelectionSchema = z.object({
  agents: z.array(AgentSchema), // rỗng ⇒ ẩn selector (FR-026)
  selectedId: z.string().nullable(), // reset null nếu rời khỏi agents (edge case)
  available: z.boolean(), // false khi agents URL unset hoặc list fetch fail
});
export type AgentSelection = z.infer<typeof AgentSelectionSchema>;
