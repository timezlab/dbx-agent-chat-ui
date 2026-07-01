# Contract: ChatTransport & the Databricks Playground SSE format

The stable seam between chat UI and the backend. Components depend only on these types;
one transport implements them. **There are no transport "modes"**: the UI always streams
from a single endpoint that speaks the **Databricks Playground / MLflow ResponsesAgent
SSE format** (OpenAI Responses shape). Whatever answers that endpoint — a real agent, a
proxy, or the local mock-api script — is indistinguishable to the UI (pivot, spec
Clarifications 2026-07-01). Frozen for this feature (Principle V).

## TypeScript interface

Data types are **entities** (`frontend/src/entities/transport.ts`): `ChatRequest`,
`ChatRequestMessage`, `ChatStreamEvent`. The behavior port lives in
`frontend/src/lib/chat/transport.ts`:

```ts
// ---- Data (entities) ----
export interface ChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  agentId?: string;        // present only when an agents API is configured + one chosen
  conversationId?: string;
}

// Neutral, backend-agnostic event vocabulary the reducer consumes.
export type ChatStreamEvent =
  | { type: "token"; delta: string }
  | { type: "reasoning"; delta: string } // "thinking" channel, separate from token
  | { type: "tool"; id: string; name: string; args?: Record<string, unknown> | null;
      detail?: string; status: "running" | "done" }
  | { type: "error"; message: string }
  | { type: "done" };

// ---- Behavior port (lib/chat) ----
export interface ChatStreamHandlers {
  onEvent(event: ChatStreamEvent): void;
  onClose?(reason: "done" | "error" | "abort"): void; // exactly once
}
export interface ChatTransport {
  send(input: ChatRequest, handlers: ChatStreamHandlers): AbortController;
}

/** The single transport. Streams the Databricks Playground SSE shape from `endpointUrl`
 *  via @microsoft/fetch-event-source + the shared parser. No modes. */
export function createChatTransport(endpointUrl: string | undefined): ChatTransport;
```

### Behavioral contract

- `send` MUST return synchronously with an `AbortController`; aborting it MUST stop event
  delivery promptly (~1s) and trigger `onClose("abort")` (FR-006, SC-003).
- Exactly one terminal signal per generation: `done` **or** `error` **or** abort.
- The transport is **live from day one** (via `@microsoft/fetch-event-source`), pattern
  ported from `lakemind/frontend/lib/api/agent-stream.ts`: `onopen` validates the
  `text/event-stream` content-type and surfaces a server `detail` on failure; `[DONE]`
  is a terminal; `onerror` rethrows to stop auto-retry (chat streams are single-shot).
- An unset/blank `endpointUrl` MUST make `send` throw a clear error, surfaced inline by
  the hook (T055) — never a silent failure.
- No secrets: the transport reads only public config and embeds no credential; auth (if
  any) is the deployment wrapper's concern via same-origin cookies (`credentials:
  "include"`), Principle II.

## The single SSE handler (Databricks Responses → ChatStreamEvent)

`frontend/src/lib/stream/responses.ts` — `createResponsesParser()` maps each Databricks
Playground Responses frame → zero or more `ChatStreamEvent`. It is the ONE handler shared
by the live transport and the recording parser. Stateful per stream (pairs tool
call↔output by `call_id`).

| Vendor frame (Databricks Responses) | → internal event |
|-------------------------------------|------------------|
| `response.output_text.delta` (`delta`) | `token` |
| `response.reasoning_text.delta` / `response.reasoning_summary_text.delta` (`delta`) | `reasoning` |
| `response.output_item.done` · `item.type = "reasoning"` | `reasoning` (whole item, when not streamed as deltas) |
| `response.output_item.done` · `item.type = "function_call"` | `tool` running (`id = call_id`, raw `name`, parsed `arguments`) |
| `response.output_item.done` · `item.type = "function_call_output"` | `tool` done (paired by `call_id`, `detail = output`) |
| `response.output_item.done` · `item.type = "message"` (terminal) | `done` (text already streamed via deltas — not re-emitted) |
| `{ databricks_output: { error } }` / `{ error }` on the last frame | `error` |
| lifecycle (`response.created`, `.output_item.added`, `.output_text.done`, `.completed`) | ignored (forward-compatible) |

Tool `name` is classified by exact match and `arguments` validated per-tool via
`frontend/src/entities/deepagents-tools/` (D12); unknown tools render generically. The
native Responses stream has **no `[DONE]`** (a trailing `trace_id` frame may appear), but
a literal `[DONE]` is still accepted as a terminal. Reasoning `signature` /
`encrypted_content` are opaque and MUST NOT be carried into the internal event or
rendered. See `docs/references/databricks-research.md` › Reasoning.

## Recording / mock-api format (Databricks Responses SSE)

A recording is the exact byte stream the real endpoint emits. The mock-api script replays
it; the live transport streams the same shape off the wire — both funnel through
`createResponsesParser()`.

- Frames separated by a blank line. Each frame: optional `event:` line + one or more
  `data:` lines (concatenated per the SSE spec). `:`-comment/`keepalive` lines ignored.
- `data:` payload is a JSON Responses frame (see the table).

Example (`frontend/public/recordings/default.txt`, abbreviated):

```text
data: {"type":"response.reasoning_text.delta","item_id":"rs_demo","delta":"Let me read the file."}

data: {"type":"response.output_text.delta","item_id":"msg_demo","delta":"I'll take a look.\n\n"}

data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"call_1","name":"read_file","arguments":"{\"file_path\":\"src/math/add.ts\"}","status":"completed"}}

data: {"type":"response.output_item.done","item":{"type":"function_call_output","call_id":"call_1","output":"export function add(a,b){return a+b}"}}

data: {"type":"response.output_text.delta","item_id":"msg_demo","delta":"It returns `a + b`."}

data: {"type":"response.output_item.done","item":{"id":"msg_demo","type":"message","content":[{"text":"It returns `a + b`."}]}}
```

### Error-frame fixture (FR-009 tests)

```text
data: {"type":"response.output_text.delta","item_id":"m","delta":"partial"}

data: {"databricks_output":{"error":"upstream failed"}}
```

## Mock-api script (zero-Databricks dev)

`frontend/scripts/mock-api.mjs` — a standalone dev-only HTTP server that serves a
recording as an SSE response in the Databricks Playground format:

- Responds with `Content-Type: text/event-stream` and streams each recorded frame with a
  small per-event delay (text fast, tool events slower — visible tool latency); honors
  client disconnect/abort.
- The UI points `NEXT_PUBLIC_CHAT_ENDPOINT_URL` at it and cannot tell it apart from a real
  endpoint (FR-011a). It owns no Databricks access and needs no secret.
