# Phase 0 Research: Chat MVP

All Technical Context items were resolved from the spec, the design docs
([`chat-transport.md`](../../../docs/design-docs/chat-transport.md),
[`customization-and-theming.md`](../../../docs/design-docs/customization-and-theming.md)),
and the existing scaffold. No `NEEDS CLARIFICATION` remain. Design decisions below.

## D1 — Mock replay: split pure parser from I/O loader

**Decision**: The mock is two pieces. (1) A **pure replay engine** `replay(text) →
async iterable/emitter of events` that parses SSE recording text and yields events
with small delays. (2) A thin **loader** that obtains the recording *text*: in the app
it `fetch`es a static asset from `public/recordings/`; in tests it reads a fixture
string directly (fs or inline). The `mockTransport` composes loader → engine and
adapts events to `ChatStreamHandlers`.

**Rationale**: Keeps replay logic pure and I/O-free, so it is unit-testable without
jsdom/network (satisfies the test-first gate cheaply). Decouples "where the bytes come
from" from "how they stream", which resolves the gitignore tension: the committed
default recording and test fixtures are ordinary files, while `sse-recordings/`
(gitignored) is an optional dev source the loader can also point at.

**Alternatives considered**: Import `.txt` as a raw module (`?raw`) — rejected: not
Next-16 static-export friendly without extra loader config, and couples replay to the
bundler. A single impure mock that does fetch+parse+stream together — rejected:
untestable without network mocking.

## D2 — Committed default recording vs gitignored captures

**Decision**: Ship one small committed recording at
`frontend/public/recordings/default.txt` (served as a static asset, drives the
zero-config demo). Committed **test fixtures** live colocated under
`src/lib/**/__tests__/fixtures/*.txt` (cover happy path, tool activity, error frame,
empty). `frontend/sse-recordings/` stays gitignored for developers' own captures and
is never required for build or CI.

**Rationale**: Satisfies FR-011a (a committed sample must ship; local captures are
never needed for tests) while honoring the earlier decision to gitignore
`sse-recordings/`. Static assets in `public/` are the static-export-safe way to ship a
file the browser can load.

**Alternatives considered**: Put the default recording in the gitignored folder —
rejected: demo/CI would have no file. Inline the default as a TS string constant —
rejected: contradicts "replay recorded files only" (Clarification Q3) and bloats code.

## D3 — SSE recording / wire format

**Decision**: Two layers, connected by a mapping step.
1. **Internal vocabulary** (frozen, backend-agnostic): the reducer consumes a
   discriminated `type` union — `token`, `tool`, `error`, `done` (see
   [`contracts/chat-transport.md`](./contracts/chat-transport.md)).
2. **On-wire recording format**: standard SSE framing (`data:` lines, blank-line
   separated). Real captures from a Databricks agent are in the **Databricks
   ResponsesAgent / OpenAI Responses** shape — `response.output_text.delta` (tokens),
   `response.output_item.done` carrying `function_call` / `function_call_output` items
   (tools), a terminal `message` item, and **no `[DONE]` sentinel** (reference capture:
   `frontend/sse-recordings/rbg-performance-2026.txt`). The parser **maps** these vendor
   events → the internal vocabulary; a real capture does **not** replay unchanged — it
   replays *through the mapping*.

The committed default recording + test fixtures MAY be authored in the simpler internal
shape for the mock; the Responses mapping is what lets real captures replay. Whether
001's parser handles the full Responses mapping now or only the simple shape is a
plan/tasks decision (see D12).

**Rationale**: One neutral internal event vocabulary keeps the reducer
backend-agnostic (Principle IV). Real adapters map vendor frames → these events; the
mock parser reuses the same mapping. `@microsoft/fetch-event-source` parses the SSE
framing off the wire.

**Alternatives considered**: Assume real captures already match the internal shape —
rejected: false; the real Databricks stream is Responses-shaped and needs mapping.
Vendor-specific event unions leaking into the reducer — rejected: violates
transport-agnostic UI; the mapping stays isolated in the adapter/parser.

## D4 — Chat state: local reducer hook, not TanStack Query cache

**Decision**: `useChat` owns conversation state via `useReducer` (feeding the pure
`reducer.ts`). Streaming events dispatch reducer actions; the active `AbortController`
and send-queue live in the hook. TanStack Query is **not** used to hold the streaming
message state in this feature (it may later wrap the non-streaming feedback call as a
mutation).

**Rationale**: SSE token streams are push, incremental, and mutable-until-done — a
poor fit for Query's request/response cache. A reducer gives an immutable settled
state with explicit transitions (Principle IV) and is trivially unit-testable
independent of React.

**Alternatives considered**: TanStack Query streaming/`useMutation` for the stream —
rejected: awkward for token-by-token accumulation and cancel. Global store (Zustand/
Redux) — rejected: single-screen session state doesn't warrant it.

## D5 — Incremental render without list-wide re-render

**Decision**: Keep the message list keyed by stable message id; only the streaming
assistant message subscribes to token updates. Assistant content renders through
`streamdown` (`Streamdown` + `@streamdown/code`), which is built for progressive
markdown. Autoscroll uses the scaffolded `MessageScroller` primitive.

**Rationale**: Meets the ~60fps / no-jank performance goal (SC-001) by not re-rendering
the whole conversation per token. Reuses existing, already-styled primitives, keeping
the customization contract intact.

**Alternatives considered**: Re-render the entire list on every token — rejected:
jank on long conversations. Hand-rolled markdown renderer — rejected: `streamdown` is
already a decided dependency (D-006).

## D6 — Send-queue semantics (Clarification Q2)

**Decision**: A FIFO queue of pending user messages. On send: if idle, dispatch
immediately; if a generation is active, enqueue and show the message as `queued`. When
a generation reaches a terminal state (done/error/cancel), dequeue the next and
dispatch. Cancel stops the active generation but does **not** drop the queue; the next
queued message proceeds. Queue logic is pure (`queue.ts`) and unit-tested.

**Rationale**: Directly implements FR-007 and the cancel-with-queued edge case; purity
keeps it testable and free of race conditions in the hook.

**Alternatives considered**: Disable composer during generation — rejected by the user
(Q2). Fire concurrent generations — rejected: violates single-active-generation and
would interleave content.

## D7 — Test harness

**Decision**: Add `vitest.config.ts` (jsdom environment, globals, setup file) and
`vitest.setup.ts` (imports `@testing-library/jest-dom`). Pure modules (`sse.ts`,
`reducer.ts`, `queue.ts`, mock replay) tested with fake timers and fixtures; components
tested with Testing Library driving `useChat` against an injected in-memory transport.

**Rationale**: The non-negotiable test-first gate needs a running harness; none exists
yet. Purity of the lib layer means most coverage needs no DOM.

**Alternatives considered**: Playwright/E2E — deferred: out of scope for this feature;
unit + component tests cover the acceptance scenarios against the mock.

## D8 — Per-capability config with graceful fallback

**Decision**: Each capability has its own optional public URL:
`NEXT_PUBLIC_CHAT_ENDPOINT_URL`, `NEXT_PUBLIC_HISTORY_API_URL`,
`NEXT_PUBLIC_FEEDBACK_API_URL`, `NEXT_PUBLIC_AGENTS_API_URL` (+ existing
`NEXT_PUBLIC_TRANSPORT_MODE`, + an optional `NEXT_PUBLIC_HISTORY_PERSISTENCE` knob
reserved for forcing `local`/`memory`). A single `src/lib/config.ts` reads `env.ts`
into a typed capability config; each `resolve*(config)` factory picks a real vs
local/mock/hidden implementation. "Capability present" = its URL is set **and** calls
succeed; a failed call demotes to the fallback at runtime.

**Rationale**: Directly implements the user's model (Clarification: "config API url per
feature; a failed history call means no history"). Keeps every backend optional and
independently deployable, honoring UI-only + customization-as-contract.

**Alternatives considered**: One combined base URL with fixed sub-paths — rejected:
hosts expose these on different origins; the user asked for per-feature URLs. A
build-time flag per capability — rejected: config must switch the same artifact at
runtime (SC-010).

## D9 — History: local-first interface, real remote provider, runtime failover

**Decision**: `HistoryProvider { load(): Promise<Conversation|null>; save(c): Promise<void> }`.
`resolveHistory(config)` returns the **remote** provider when the history URL is set,
else the **local** (`localStorage`) provider. The remote provider is built for real
(fetch GET/PUT JSON). A wrapper catches remote failures and **falls back to local**
per call, so a runtime error demotes history to local without losing the in-session
conversation. `local` degrades to in-memory when `localStorage` throws (private mode).
The live conversation always exists in React state; the provider is the persistence
side-channel, written on turn completion and read on startup.

**Rationale**: Implements FR-018..FR-020 and the "call fails → treat as no history"
clarification. Interface keeps components decoupled (Principle IV); the failover
wrapper centralizes the graceful-degradation rule so it is unit-testable with a
fetch mock + a throwing storage stub.

**Alternatives considered**: Memory-only default — rejected by user (localStorage
chosen). Persisting every token during streaming — rejected: churns storage; persist
on terminal states only. IndexedDB — over-engineered for a single active conversation.

## D10 — Feedback: sink interface, real remote POST, non-blocking failure

**Decision**: `FeedbackSink { submit(f: Feedback): Promise<void> }` with `Feedback =
{ messageId, rating: "up"|"down", comment?: string }`. `resolveFeedback(config)`
returns the **remote** sink (real `POST` to the feedback URL) when set, else the
**mock** no-op/local sink. Submission is fire-and-forget from the UI's perspective:
the selected state updates optimistically; a rejected `submit` shows a non-blocking
notice and retains the selection (FR-021).

**Rationale**: Implements the "thumbs + comment → configurable sink" clarification and
the non-blocking failure edge case. Same resolve-by-config shape as history/chat for
consistency and testability (mocked fetch).

**Alternatives considered**: Block the UI on submit — rejected: feedback must never
interrupt chatting. MLflow-specific client — rejected: out of scope, UI-only (generic
endpoint only).

## D11 — Agents: real list fetch, id-param routing, selector hidden on absence

**Decision**: `AgentsClient { list(): Promise<Agent[]> }` where `Agent = { id, name }`,
a **real** GET to the agents URL. `use-agents` fetches via TanStack Query when the URL
is set and holds the selected `agentId`. The selected id is injected into
`ChatRequest.agentId` for every send. When the URL is unset, the query errors, or the
list is empty, `use-agents` reports "no agents" and the selector is not rendered;
requests carry no `agentId` (FR-024..FR-026). If the selected agent disappears on
refetch, selection resets to none.

**Rationale**: Implements the agent clarifications (single endpoint + `agentId` param;
hide selector when absent). TanStack Query fits a cacheable list fetch (unlike the
push stream in D4). Keeping `agentId` an optional field on `ChatRequest` means the
mock and future real transports thread it through unchanged.

**Alternatives considered**: Per-agent endpoint switching — rejected by user (id-param
chosen). Always show a disabled selector — rejected: cleaner to hide when there are no
agents. Storing agent list in the reducer — rejected: it is server cache state, not
conversation state (belongs in Query).

## D12 — Tool taxonomy: classify by raw tool name, per-tool schemas, no `kind` field

**Decision**: The backend is a **LangChain deepagents** agent. Its default tools carry
stable, hardcoded names surfaced verbatim on the stream, so the UI classifies a tool
purely by **exact `name` match** — there is no `kind`/`category` field on the wire (this
matches every platform surveyed: OpenAI, Anthropic, Vercel AI SDK, AG-UI, MLflow).
Default deepagents tools (v0.4.12, source-verified): `write_todos`, `ls`, `read_file`,
`write_file`, `edit_file`, `glob`, `grep`, `execute` (only on sandbox/local-shell
backends), `task`, `compact_conversation`. Each tool has its own args schema (zod) with
the **original arg keys** preserved, plus a `z.discriminatedUnion("name", …)` and a
`parseToolCall(name, args)` that validates + narrows; unknown/custom tools fail the
parse and render as a generic card. Reference impl: `frontend/src/entities/deepagents-tools/`.

Two related facts captured here:
- **Auto-compaction is NOT a tool.** deepagents' `SummarizationMiddleware` compacts
  the conversation automatically (default at ~0.85 of context), replacing old messages
  with a summary; it surfaces as a `SummarizationEvent` (a system notice), distinct from
  the `compact_conversation` *tool* the agent may call on demand.
- **Backend normalization principle**: `name` MUST be the raw stable tool id — never a
  decorated display label (the reference capture wrongly emits e.g. `"📖 Reading: …"`).
  Any human label/icon belongs in `custom_outputs` (the MLflow-sanctioned metadata
  channel), not in `name`.

**Rationale**: Exact-name matching is robust and dependency-free because deepagents
names are hardcoded; per-tool schemas give typed rendering + safe fallback for custom
tools. Keeping classification out of the wire matches industry practice and keeps the UI
transport-agnostic (Principle IV).

**Scope note**: Rich per-tool widgets are **beyond 001** (US3 tool surface is
placeholder fidelity). 001 uses these schemas only to (a) parse/label tool activity and
(b) fix the recording-format mapping (D3). Full deepagents/Responses rendering is a
later feature.

**Alternatives considered**: Heuristic name normalization (strip emoji, keyword match)
— rejected: fragile, only needed if the backend keeps decorating `name` (fix the backend
instead). A synthetic `kind` enum on the wire — rejected: no platform does this;
derive it client-side if ever needed.
