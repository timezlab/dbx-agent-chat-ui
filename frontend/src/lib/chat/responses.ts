import type { ChatStreamEvent } from "@/entities";

/**
 * Map the **Databricks Playground / MLflow ResponsesAgent** SSE shape (OpenAI Responses)
 * → the neutral `ChatStreamEvent` vocabulary. This is THE single SSE handler: the mock
 * replays a recording in this exact shape, and the live networked transports
 * (static-proxy / responses) stream the same shape off the wire — both go through here
 * (contracts/chat-transport.md › Real-adapter mapping, D3).
 *
 * Stateful per stream: a `function_call` item announces a tool (running); the later
 * `function_call_output` item (paired by `call_id`) carries the result → done. The parser
 * remembers `call_id → { name, args }` so the result event can carry the tool's name.
 * Create one parser per stream.
 */
export interface ResponsesParser {
  map(event: unknown): ChatStreamEvent[];
}

interface PendingCall {
  name: string;
  args: Record<string, unknown> | null;
}

export function createResponsesParser(): ResponsesParser {
  const calls = new Map<string, PendingCall>();

  return {
    map(event: unknown): ChatStreamEvent[] {
      if (!isRecord(event)) return [];

      // Error can arrive as `{ databricks_output: { error } }` on the last frame,
      // or a plain `{ error }` / `{ type: "error", message }`.
      const errorMessage = extractError(event);
      if (errorMessage != null) return [{ type: "error", message: errorMessage }];

      const type = typeof event.type === "string" ? event.type : "";

      switch (type) {
        case "response.output_text.delta":
          return textEvent("token", event.delta);

        case "response.reasoning_text.delta":
        case "response.reasoning_summary_text.delta":
          return textEvent("reasoning", event.delta);

        case "response.output_item.done":
          return mapItemDone(event.item, calls);

        default:
          return []; // lifecycle / unknown → ignored (forward-compatible)
      }
    },
  };
}

function textEvent(
  type: "token" | "reasoning",
  delta: unknown,
): ChatStreamEvent[] {
  return typeof delta === "string" && delta.length > 0
    ? [{ type, delta }]
    : [];
}

function mapItemDone(
  item: unknown,
  calls: Map<string, PendingCall>,
): ChatStreamEvent[] {
  if (!isRecord(item)) return [];
  const itemType = item.type;

  if (itemType === "function_call") {
    const id = asString(item.call_id) ?? asString(item.id) ?? "";
    const name = asString(item.name) ?? "";
    const args = parseArgs(item.arguments);
    calls.set(id, { name, args });
    return [
      {
        type: "tool",
        id,
        name,
        args,
        detail: undefined,
        status: "running",
      },
    ];
  }

  if (itemType === "function_call_output") {
    const id = asString(item.call_id) ?? "";
    const prior = calls.get(id);
    return [
      {
        type: "tool",
        id,
        name: prior?.name ?? "",
        args: prior?.args ?? null,
        detail: asString(item.output) ?? undefined,
        status: "done",
      },
    ];
  }

  if (itemType === "reasoning") {
    // Whole reasoning item (when a model does not stream reasoning deltas).
    const text = joinContentText(item.content);
    return text ? [{ type: "reasoning", delta: text }] : [];
  }

  if (itemType === "message") {
    // Terminal. Text was already streamed via output_text.delta — do not re-emit.
    return [{ type: "done" }];
  }

  return [];
}

function parseArgs(raw: unknown): Record<string, unknown> | null {
  if (isRecord(raw)) return raw;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function joinContentText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((c) => (isRecord(c) && typeof c.text === "string" ? c.text : ""))
    .join("");
}

function extractError(event: Record<string, unknown>): string | null {
  const dbx = event.databricks_output;
  if (isRecord(dbx) && typeof dbx.error === "string") return dbx.error;
  if (typeof event.error === "string") return event.error;
  if (event.type === "error" && typeof event.message === "string") {
    return event.message;
  }
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
