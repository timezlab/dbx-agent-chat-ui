import type { Conversation, ConversationSummary } from "@/entities";

const MAX_TITLE_LEN = 48;

/** First user line → a trimmed title; an empty session reads as "New chat". */
export function conversationTitle(conversation: Conversation): string {
  const firstUser = conversation.messages.find((m) => m.role === "user");
  const text = (firstUser?.parts ?? [])
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
  if (!text) return "New chat";
  return text.length > MAX_TITLE_LEN ? `${text.slice(0, MAX_TITLE_LEN)}…` : text;
}

/**
 * Derive a sidebar list row from a full conversation. `updatedAt` is the last turn's
 * `createdAt` (0 for an empty session), so summaries sort newest-first consistently
 * whether they come from the local store or a backend that returns full conversations.
 */
export function summarizeConversation(
  conversation: Conversation,
): ConversationSummary {
  const last = conversation.messages[conversation.messages.length - 1];
  return {
    id: conversation.id,
    title: conversationTitle(conversation),
    updatedAt: last?.createdAt ?? 0,
    messageCount: conversation.messages.length,
  };
}
