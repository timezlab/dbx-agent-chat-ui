import { z } from "zod";

/**
 * compact_conversation — sự kiện START (tool call).
 * Không có arg model-facing ⇒ object rỗng. Ứng với `function_call` trên wire.
 */
export const compactConversationSchema = z.object({
  name: z.literal("compact_conversation"),
  args: z.object({}),
});
export type CompactConversationCall = z.infer<typeof compactConversationSchema>;

/**
 * compact_conversation — sự kiện END (kết quả).
 * Ứng với `function_call_output` (ghép theo call_id).
 * `summary` là nội dung đã compact; `messagesBefore`/`messagesAfter` là
 * số lượng message trước và sau khi nén.
 */
export const compactConversationResultSchema = z.object({
  name: z.literal("compact_conversation"),
  status: z.literal("done"),
  summary: z.string(),
  messagesBefore: z.number().int(),
  messagesAfter: z.number().int(),
});
export type CompactConversationResult = z.infer<typeof compactConversationResultSchema>;
