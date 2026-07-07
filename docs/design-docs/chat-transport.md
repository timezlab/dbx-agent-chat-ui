# Chat Transport, Streaming, and Markdown Rendering

**Status:** accepted
**Date:** 2026-07-01
**Covers:** D-004 (adapter transport), D-005 (streaming), D-006 (assistant markdown)

## Context

The UI must talk to several kinds of Databricks agent endpoints (Apps, Model
Serving, notebook proxy, legacy chat completions) without knowing which one it is,
and must render streamed agent output that is often markdown, SQL, code, tables,
sources, and tool traces. The static-export contract
([`repo-boundaries.md`](./repo-boundaries.md)) rules out server-side transport, so
everything runs client-side.

## Decision

### Adapter-based agent transport (D-004)

Define a single frontend chat transport interface; deployment details live behind
adapters.

```ts
export interface ChatTransport {
  send(input: ChatRequest, handlers: ChatStreamHandlers): AbortController;
}
```

`ChatRequest` is a **thin request** — it carries only the current user turn (`query` +
optional `attachments`) plus `conversationId`, never the full history array. The backend owns
the accumulating Checkpoint (working context) and the durable History table, both keyed by
`conversationId`. See ADR [`request-context-ownership.md`](./request-context-ownership.md).

| Adapter | Purpose |
| --- | --- |
| `staticProxyTransport` | Browser calls the notebook/proxy-exported backend endpoint. |
| `databricksAppsTransport` | Browser calls a Databricks Apps or gateway endpoint provided outside this UI repo. |
| `databricksResponsesTransport` | Parses Responses API stream events. |
| `databricksChatCompletionsTransport` | Parses legacy Chat Completions style stream events. |
| `mockTransport` | Local UI development and tests without Databricks access. |

The UI should not know whether the backend is Databricks Apps, Model Serving, a
notebook proxy, or a mock. The endpoint URL, transport mode, and endpoint
**path/naming** are configuration, never hardcoded constants — see
[`customization-and-theming.md`](./customization-and-theming.md) (section C).

### Streaming via `@microsoft/fetch-event-source` (D-005)

Use `@microsoft/fetch-event-source`. It is already used in `specdeck` and
`lakemind/frontend`; it supports POST SSE, custom headers, request bodies,
`AbortController`, and retry — which native `EventSource` cannot do for agent
endpoints that need request bodies.

Use an event reducer similar to Lakemind's pattern:

- Add optimistic user message immediately.
- Add an empty assistant message with `streaming: true`.
- Apply stream events to content, tool timeline, source blocks, trace metadata, and errors.
- Abort on cancel or terminal `[DONE]`/done event.
- Keep final assistant state immutable and cache invalidation explicit.

#### Usage / metrics events (per-reply time · TTFT · tokens · cost)

The neutral event vocabulary carries a non-terminal **`usage`** event
(`{ inputTokens?, outputTokens?, totalTokens?, costUsd?, durationMs?, ttftMs?, contextUsed?,
contextWindow? }`) and an optional **`durationMs`** on the `tool` event. The Responses parser
maps a `response.completed` frame — or any frame carrying `usage` / `databricks_output.usage`
— to a `usage` event, and reads `duration_ms` off a `function_call_output` for per-tool run
time. `contextUsed` (wire `context_used`/`checkpoint_tokens`) + `contextWindow` (wire
`context_window`/`max_tokens`) feed the context-window meter — occupancy is `contextUsed` (the
backend Checkpoint size), deliberately **not** `totalTokens`, which for a looping agent is
cumulative billing across internal steps. See ADR
[`context-meter-occupancy-source.md`](./context-meter-occupancy-source.md).
The reducer attaches usage to the **last assistant turn regardless of `activeId`** (it may
arrive around the terminal `done`), and threads the tool duration onto the timeline item;
both land on `Message.metrics` / `ToolActivityItem.durationMs`, so they round-trip through
history like feedback.

Split of responsibility, so the feature degrades gracefully:

- **Time & TTFT** are measured **client-side** (`MessageMetrics` component): a realtime clock
  that ticks while streaming, freezes on settle, and captures time-to-first-token when the
  first content renders. No backend needed. A *reloaded* turn shows these only if the backend
  persisted `durationMs`/`ttftMs`.
- **Tokens & cost** are **backend-provided** — Databricks `usage` gives token counts only, so
  **cost must be sent by the backend** (`cost_usd`); the UI never estimates it. No `usage`
  frame ⇒ just the client clock is shown.

Because our transport treats the `message` item's `output_item.done` as the terminal (it
closes the stream), a **live** backend must emit its `usage` frame *before* that terminal item
for tokens/cost to be captured (the bundled mock, `sse-recordings/default.txt`, is ordered
that way). Display is gated by `NEXT_PUBLIC_SHOW_USAGE` (default on; opt-out).

### Assistant markdown via `streamdown` (D-006)

Use `streamdown`, `@streamdown/code`, and `@streamdown/mermaid`. Lakemind already
uses this for chat; specdeck uses `streamdown` for generated prose. Default
rendering:

- Markdown prose through `Streamdown`.
- Tool calls and traces as structured UI, not raw markdown when possible.
- SQL as a dedicated block with copy/download actions.
- Sources/citations as separate cards or inline reference chips.
- **Reference-style links** (`[text][ref]` + trailing `[ref]: url`) are resolved to
  inline links *before* Streamdown (`lib/markdown/reference-links.ts`), since Streamdown
  parses block-by-block and can't see a definition in another block. The Streamdown
  `key` also flips on stream-settle so the late structural rewrite re-parses cleanly
  (Streamdown caches blocks across streaming frames).
- **Inline base64 images** (`data:image/…`) are rendered by us with a plain `<img>`
  *outside* Streamdown (`lib/markdown/data-images.ts`): Streamdown/`rehype-harden`
  hard-blocks `data:` URIs with no opt-in prop. Scope-limited to `data:image/…` (passive
  via `<img>`), so the block stays in force for everything else.

## Alternatives considered

- **Native `EventSource`** — rejected. Cannot send request bodies or custom headers, which agent endpoints require.
- **AI SDK streaming** — deferred (see [`stack-and-conventions.md`](./stack-and-conventions.md)); the local streaming stack already works in static mode.
- **Rendering everything as raw markdown** — rejected. Tool traces, SQL, and sources deserve structured UI.

## Consequences

**Better:**
- The UI is decoupled from any specific Databricks endpoint shape — add a backend by adding an adapter.
- `mockTransport` enables UI development and tests with no Databricks access.

**Worse:**
- We own the stream-event reducer and its edge cases (abort, terminal events, error frames).
- Each new endpoint shape needs a new adapter + event parser.

**Must now be true (invariants):**
- All chat backends are reached through a `ChatTransport` adapter — components never fetch an endpoint directly.
- Streaming goes through `@microsoft/fetch-event-source`, not native `EventSource`.
- Final assistant message state is immutable; cache invalidation is explicit.

## Revisit if

An endpoint shape appears that the adapter interface can't express cleanly, or the
AI SDK becomes a better fit than the hand-rolled reducer.
