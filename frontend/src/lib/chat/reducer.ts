import {
  type ChatSession,
  type ChatStreamEvent,
  type Message,
  type MessageMetrics,
  type MessagePart,
  type ToolActivityItem,
  parseToolCall,
} from "@/entities";

/**
 * Pure reducer: apply one `ChatStreamEvent` to the session's ACTIVE assistant
 * message, assembling `Message.parts[]` from event ORDER (data-model.md › MessagePart).
 * Operates on the runtime `ChatSession` (needs `activeId`/`status`), not the persisted
 * `Conversation`. No I/O, no mutation — returns a new `ChatSession`.
 *
 * US1 handles `token` + `done`; US3 adds `tool` upsert + `error`. `reasoning` (T057)
 * extends the switch below.
 */
export function reduceStreamEvent(
  conversation: ChatSession,
  event: ChatStreamEvent,
): ChatSession {
  // Usage is not tied to the streaming state machine: it can arrive just before or after
  // the terminal `done` (which nulls `activeId`), so attach it to the LAST assistant turn
  // regardless — handled before the `!activeId` guard below.
  if (event.type === "usage") {
    return mapLastAssistant(conversation, (m) => ({
      ...m,
      metrics: mergeMetrics(m.metrics, event),
    }));
  }

  const { activeId } = conversation;
  if (!activeId) return conversation; // nothing streaming → ignore

  switch (event.type) {
    case "token":
      return mapActive(conversation, (m) => ({
        ...m,
        parts: appendText(m.parts, event.delta),
      }));

    case "reasoning":
      return mapActive(conversation, (m) => ({
        ...m,
        parts: appendReasoning(m.parts, event.delta),
      }));

    case "done":
      return {
        ...mapActive(conversation, (m) => ({
          ...m,
          parts: dropEmptyParts(extractSuggestions(m.parts)),
          status: "complete",
        })),
        activeId: null,
        status: "idle",
      };

    case "tool":
      return mapActive(conversation, (m) => ({
        ...m,
        parts: upsertTool(m.parts, event),
      }));

    case "error":
      return {
        ...mapActive(conversation, (m) => ({
          ...m,
          status: "error",
          error: event.message,
        })),
        activeId: null,
        status: "idle",
      };

    default:
      return conversation;
  }
}

/** Build a `ToolActivityItem` from a `tool` event, validating args per-tool (D12). */
function toToolItem(event: Extract<ChatStreamEvent, { type: "tool" }>): ToolActivityItem {
  const validated = parseToolCall(event.name, event.args ?? undefined);
  const args =
    (validated?.args as Record<string, unknown> | undefined) ??
    event.args ??
    null;
  return {
    id: event.id,
    name: event.name,
    args,
    detail: event.detail ?? null,
    status: event.status,
    ...(event.durationMs != null ? { durationMs: event.durationMs } : {}),
  };
}

/** Upsert (by `call_id`) a tool item into the trailing `tools` part, opening one
 *  when the last part is not `tools` (preserves text↔tool chronology). */
function upsertTool(
  parts: MessagePart[],
  event: Extract<ChatStreamEvent, { type: "tool" }>,
): MessagePart[] {
  const incoming = toToolItem(event);
  const last = parts[parts.length - 1];
  if (last?.type === "tools") {
    const idx = last.items.findIndex((i) => i.id === incoming.id);
    const items =
      idx >= 0
        ? last.items.map((i, j) => (j === idx ? mergeTool(i, incoming) : i))
        : [...last.items, incoming];
    return [...parts.slice(0, -1), { type: "tools", items }];
  }
  return [...parts, { type: "tools", items: [incoming] }];
}

/** Merge a later tool event (e.g. the paired output → `done`) onto the running item. */
function mergeTool(
  existing: ToolActivityItem,
  incoming: ToolActivityItem,
): ToolActivityItem {
  return {
    id: existing.id,
    name: incoming.name || existing.name,
    args: incoming.args ?? existing.args,
    detail: incoming.detail ?? existing.detail,
    status: incoming.status === "done" ? "done" : existing.status,
    ...(incoming.durationMs ?? existing.durationMs) != null
      ? { durationMs: incoming.durationMs ?? existing.durationMs }
      : {},
  };
}

/** Append `delta` to the trailing `text` part, opening a new one if needed. */
function appendText(parts: MessagePart[], delta: string): MessagePart[] {
  const last = parts[parts.length - 1];
  if (last?.type === "text") {
    return [...parts.slice(0, -1), { type: "text", text: last.text + delta }];
  }
  const text = openingDelta(delta);
  if (text === "") return parts; // whitespace-only burst before any real content
  return [...parts, { type: "text", text }];
}

/** Append `delta` to the trailing `reasoning` part, opening a new one if needed. */
function appendReasoning(parts: MessagePart[], delta: string): MessagePart[] {
  const last = parts[parts.length - 1];
  if (last?.type === "reasoning") {
    return [...parts.slice(0, -1), { type: "reasoning", text: last.text + delta }];
  }
  const text = openingDelta(delta);
  if (text === "") return parts; // whitespace-only burst before any real content
  return [...parts, { type: "reasoning", text }];
}

/**
 * Leading whitespace at a part boundary is model padding, not content — some streams
 * emit a lone `" "` delta before the real answer (see rbg-performance recording). Drop
 * it so a stray space can't open an empty part that splits an otherwise-contiguous
 * reasoning/tools run out of one process group. Interior spaces are left untouched:
 * this only trims the delta that OPENS a fresh part.
 */
function openingDelta(delta: string): string {
  return delta.replace(/^\s+/, "");
}

/** On `done`, drop `text`/`reasoning` parts that are empty after trimming. */
function dropEmptyParts(parts: MessagePart[]): MessagePart[] {
  return parts.filter(
    (p) =>
      (p.type !== "text" && p.type !== "reasoning") || p.text.trim() !== "",
  );
}

/** 
 * Extract `<suggested-followups>` XML block from the final text part, removing it
 * from the Markdown rendering and converting it into a structured `SuggestionsPart`.
 */
function extractSuggestions(parts: MessagePart[]): MessagePart[] {
  if (parts.length === 0) return parts;
  const last = parts[parts.length - 1];
  if (last.type !== "text") return parts;

  const match = last.text.match(/<suggested-followups>([\s\S]*?)<\/suggested-followups>/);
  if (!match) return parts;

  const innerXml = match[1];
  const questionMatches = [...innerXml.matchAll(/<question>([\s\S]*?)<\/question>/g)];
  const questions = questionMatches.map((m) => m[1].trim()).filter(Boolean);

  if (questions.length === 0) return parts;

  const cleanText = last.text.replace(/<suggested-followups>[\s\S]*?<\/suggested-followups>/, "").replace(/\s+$/, "");

  const newParts = [...parts.slice(0, -1)];
  if (cleanText) {
    newParts.push({ type: "text", text: cleanText });
  }
  newParts.push({ type: "suggestions", items: questions });
  
  return newParts;
}

/** Rebuild the session with the active message transformed. */
function mapActive(
  conversation: ChatSession,
  fn: (m: Message) => Message,
): ChatSession {
  return {
    ...conversation,
    messages: conversation.messages.map((m) =>
      m.id === conversation.activeId ? fn(m) : m,
    ),
  };
}

/** Rebuild the session with the LAST assistant message transformed (or unchanged when
 *  there is none). Used for `usage`, which attaches to the reply even once `done` has
 *  cleared `activeId`. */
function mapLastAssistant(
  conversation: ChatSession,
  fn: (m: Message) => Message,
): ChatSession {
  let idx = -1;
  for (let i = conversation.messages.length - 1; i >= 0; i--) {
    if (conversation.messages[i].role === "assistant") {
      idx = i;
      break;
    }
  }
  if (idx === -1) return conversation;
  return {
    ...conversation,
    messages: conversation.messages.map((m, i) => (i === idx ? fn(m) : m)),
  };
}

/** Fold a `usage` event onto prior metrics, keeping only the numbers actually present so
 *  a later frame (e.g. cost after tokens) merges instead of clobbering. */
function mergeMetrics(
  prev: MessageMetrics | undefined,
  event: Extract<ChatStreamEvent, { type: "usage" }>,
): MessageMetrics {
  const next: MessageMetrics = { ...prev };
  if (event.inputTokens != null) next.inputTokens = event.inputTokens;
  if (event.outputTokens != null) next.outputTokens = event.outputTokens;
  if (event.totalTokens != null) next.totalTokens = event.totalTokens;
  if (event.costUsd != null) next.costUsd = event.costUsd;
  if (event.durationMs != null) next.durationMs = event.durationMs;
  if (event.ttftMs != null) next.ttftMs = event.ttftMs;
  if (event.contextUsed != null) next.contextUsed = event.contextUsed;
  if (event.contextWindow != null) next.contextWindow = event.contextWindow;
  return next;
}
