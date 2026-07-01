# Phase 1 Data Model: Chat MVP

Client-only, in-memory types. No persistence. Concrete TypeScript shapes are frozen in
[`contracts/chat-transport.md`](./contracts/chat-transport.md); this file describes the
domain and its rules.

## Entities

### Message

One turn in the conversation.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Stable, unique; the React key and reducer target. |
| `role` | `"user" \| "assistant"` | |
| `parts` | `MessagePart[]` | Ordered timeline of `text` / `tools` parts (see below). User = one `text` part. |
| `status` | `MessageStatus` | See state machine below. |
| `error` | `string \| null` | Assistant only; set on error frame. |
| `feedback` | `"up" \| "down" \| null` | Assistant only; current single choice. |
| `createdAt` | number | Session-relative ordering (from injected clock, not `Date.now()` in pure code). |

**Rules**:
- User messages are created optimistically and are immutable after creation (FR-002).
- Only one assistant message may be `streaming` at a time (FR-007).
- `feedback` reflects a single current choice; toggling replaces it (edge case).
- History sent back (`ChatRequest.messages[].content: string`) is derived by flattening a
  message's `text` parts (tools omitted).

### MessagePart (assistant timeline)

A turn can stream text in **multiple bursts** interleaved with tool activity (the real
capture `rbg-performance-2026.txt` streams text 3 times around 24 tool calls, all under one
`item_id`). `parts` preserves that chronology so the UI renders text → tools → text → … in
order, instead of one lumped bubble + a detached tool list.

| Variant | Shape | Notes |
|---------|-------|-------|
| `text` | `{ type: "text"; text: string }` | A contiguous markdown run; grows while streaming. |
| `tools` | `{ type: "tools"; items: ToolActivityItem[] }` | A run of consecutive tool calls, rendered as one collapsible activity block. |
| `reasoning` | `{ type: "reasoning"; text: string }` | A "thinking" run from a Databricks reasoning model; rendered as a **collapsible block, collapsed by default**, distinct from answer text. Opaque `signature`/`encrypted_content` are dropped. |

The reducer builds `parts` **purely from event order** (so `ChatStreamEvent` needs no
`item_id`): a `token` appends to the trailing `text` part (opening one if the last part is
not `text`); a `tool` appends to the trailing `tools` part (opening one if the last part is
not `tools`), pairing call↔output by `call_id`; a `reasoning` delta appends to the trailing
`reasoning` part (opening one if the last part is not `reasoning`). On `done`,
empty-after-trim `text` / `reasoning` parts are dropped (e.g. a burst that was only
whitespace). Assumes one text `item_id` per turn; a future multi-`item_id` turn would need
per-`item_id` keying (separate messages). The committed deepagents recording emits no
`reasoning` parts (real reasoning arrives via stubbed real adapters, D3).

### MessageStatus (assistant lifecycle)

```text
queued ──(dispatch)──▶ streaming ──(done)──────▶ complete
  │                        │
  │                        ├──(error frame)────▶ error   (parts kept, error set)
  │                        └──(user cancel)────▶ stopped (partial parts kept)
  └──(never dispatched before cancel-all)──────▶ (remains queued / retained)
```

- `queued`: a user message accepted while a generation was active (FR-007). User
  messages themselves are `complete` on creation; `queued` applies to the *pending
  send*, tracked in the queue (see Conversation.queue).
- `streaming`: assistant reply is actively receiving tokens.
- `complete`: terminal, `done` received.
- `stopped`: terminal, user cancelled; partial parts retained (US2).
- `error`: terminal, stream emitted an error; `error` populated, remains usable (FR-009).

Terminal states never transition back to `streaming` (cancel/error/done are
idempotent — edge cases).

### ToolActivityItem

Agent tool usage shown on the timeline surface (placeholder fidelity this feature).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique within the message; pairs call↔output via the stream `call_id`. |
| `name` | string | Raw tool id (the classifier — exact-match against deepagents tools, D12). Never a decorated label. |
| `args` | object \| null | Structured, validated per-tool args (D12). Placeholder may only show a summary this feature. |
| `detail` | string \| null | Optional short description/args summary. |
| `status` | `"running" \| "done"` | Placeholder; may stay `running` if recording ends. |

`write_todos` is a special case: successive calls **replace the whole todo list** (no
per-item id), so the UI renders one evolving checklist, not multiple items (D12).

### Conversation

The single active session.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Conversation identifier (for history load/save and remote routing). |
| `messages` | `Message[]` | Ordered oldest→newest. |
| `activeId` | string \| null | Id of the currently streaming assistant message, else null. |
| `queue` | `string[]` | FIFO of pending user-message texts awaiting dispatch (D6). |
| `status` | `"idle" \| "streaming"` | Derived from `activeId`. |

**Rules**:
- Lives in React state during the session; **persisted** via the resolved
  `HistoryProvider` (remote when configured, else `localStorage`, else in-memory) on
  terminal turn transitions and restored on startup (FR-018..FR-020, D9).
- At most one `activeId`; sends while streaming append to `queue` (FR-007).
- On terminal transition of the active message, the reducer pops `queue` and starts the
  next generation (D6).
- Starting a new conversation replaces the persisted state (no stale resurrection).

### CapabilityConfig

Typed view of the public config (read from `env.ts` via `src/lib/config.ts`). Each URL
is independent and optional (D8).

| Field | Type | Notes |
|-------|------|-------|
| `chatEndpointUrl` | string \| undefined | `NEXT_PUBLIC_CHAT_ENDPOINT_URL`; the **single** chat endpoint (Databricks Playground SSE format). Unset ⇒ inline notice. No transport-mode field. |
| `historyUrl` | string \| undefined | `NEXT_PUBLIC_HISTORY_API_URL`; unset ⇒ localStorage. |
| `feedbackUrl` | string \| undefined | `NEXT_PUBLIC_FEEDBACK_API_URL`; unset ⇒ mock sink. |
| `agentsUrl` | string \| undefined | `NEXT_PUBLIC_AGENTS_API_URL`; unset ⇒ selector hidden. |

**Rules**:
- Never contains secrets (Principle II). Only these public values reach the client.
- There is **no transport "mode"**: one live SSE transport streams `chatEndpointUrl`
  (real agent / proxy / mock-api script — indistinguishable, FR-011). History/feedback/
  agents remote providers are real.
- "Capability present" = URL set **and** calls succeed; a failed call demotes to the
  fallback at runtime (D8–D11).

### Agent

A selectable backend agent (fetched from the agents API).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Sent as `ChatRequest.agentId`. |
| `name` | string | Display label in the selector. |

### AgentSelection

| Field | Type | Notes |
|-------|------|-------|
| `agents` | `Agent[]` | Empty ⇒ selector hidden (FR-026). |
| `selectedId` | string \| null | Included on chat requests; resets to null if it leaves `agents` (edge case). |
| `available` | boolean | False when agents URL unset or list fetch failed. |

### Providers (resolved by config, not persisted entities)

- **HistoryProvider**: `load()`/`save()`; remote (real fetch) or local (`localStorage`
  → in-memory degrade). Runtime failover to local on remote error (D9).
- **FeedbackSink**: `submit(feedback)`; remote (real POST) or no-op/local mock (D10).
- **AgentsClient**: `list()`; real GET; absent/failed ⇒ no agents (D11).

### Feedback

A per-reply submission passed to the resolved `FeedbackSink`.

| Field | Type | Notes |
|-------|------|-------|
| `messageId` | string | Target assistant message. |
| `rating` | `"up" \| "down"` | |
| `comment` | string \| undefined | Optional free-text ("feedback message"). |

Sink signature is `submit(f: Feedback): Promise<void>` — remote POST when a feedback
URL is set, else no-op/local mock (FR-010, FR-021, D10). MLflow-specific logging is out
of scope. The message's `feedback` field reflects the current rating; failures are
non-blocking and retain the selection.

## Stream events (transport → reducer)

Neutral, backend-agnostic vocabulary the reducer consumes (full shapes in the
contract):

| Event | Effect on model |
|-------|-----------------|
| `token` | Append `delta` to the trailing `text` part (open a new `text` part if the last part is not `text`). |
| `reasoning` | Append `delta` to the trailing `reasoning` part (open a new one if the last part is not `reasoning`); "thinking" channel, Databricks reasoning models. |
| `tool` | Upsert a `ToolActivityItem` (by `call_id`) into the trailing `tools` part (open a new `tools` part if the last part is not `tools`); carries raw `name` + parsed `args`. |
| `error` | Set active assistant `error`, status → `error`, clear `activeId`. |
| `done` / `[DONE]` | Status → `complete`, clear `activeId`, dequeue next. |

The single SSE handler (`lib/stream/responses.ts`, `createResponsesParser()`) maps the
**Databricks Playground Responses** stream (`response.output_text.delta`,
`response.reasoning_text.delta` / reasoning items, `response.output_item.done` with
`function_call` / `function_call_output`, terminal `message`, no `[DONE]`) onto this
vocabulary (D3) — for both the live transport and the mock-api recording. An
auto-compaction notice (`SummarizationEvent`, D12) is a **non-tool** system event, not
part of this union.

Cancel is a client action (abort), not a stream event: status → `stopped`, clear
`activeId`, dequeue next.
