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

### Assistant markdown via `streamdown` (D-006)

Use `streamdown`, `@streamdown/code`, and `@streamdown/mermaid`. Lakemind already
uses this for chat; specdeck uses `streamdown` for generated prose. Default
rendering:

- Markdown prose through `Streamdown`.
- Tool calls and traces as structured UI, not raw markdown when possible.
- SQL as a dedicated block with copy/download actions.
- Sources/citations as separate cards or inline reference chips.

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
