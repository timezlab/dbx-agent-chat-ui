# Implementation Plan: Chat MVP

**Branch**: `001-chat-mvp` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specify/specs/001-chat-mvp/spec.md`

## Summary

Build a single, reusable chat screen that sends a user message and renders a
streamed assistant reply, driven through one `ChatTransport`. **There are no transport
"modes"**: the UI always streams from a single endpoint speaking the **Databricks
Playground / MLflow ResponsesAgent SSE format**, live from day one via
`@microsoft/fetch-event-source` + a single SSE handler (pattern ported from
`lakemind/frontend`). Whatever answers the endpoint — a real agent, a proxy, or a
dev-only **mock-api script** that replays a recorded stream — is indistinguishable to
the UI. State is managed by a client-side hook that owns an immutable message list, a
single active generation, a **send-queue** (extra sends auto-dispatch after the
current generation), cancel, tool activity, and inline errors.

Three host-optional capabilities extend the surface, each selected by its **own public
API URL** with a defined fallback (Clarifications, session 2):

- **History** — conversation persists across reloads. Remote history provider (real
  requests to a configured history URL) when set; otherwise `localStorage`, degrading
  to in-memory. A failed history call is treated as "no history" and falls back.
- **Feedback** — thumbs up/down + optional comment, POSTed to a configured feedback
  URL (real) or a no-op/local mock sink when unset. Failures are non-blocking.
- **Agents** — when an agents URL is set, fetch the agent list (id + name) and show a
  selector; the chosen `agentId` rides along on each chat request to the single chat
  endpoint. No agents URL / failure / empty list → selector shows default 'Agent', default endpoint.

Rendering reuses the scaffolded shadcn chat primitives (`Message`, `Bubble`,
`MessageScroller`) and `streamdown`. All configuration lives in the `NEXT_PUBLIC_*`
env surface. Everything is client-only, secret-free, and static-export safe; the UI
owns no history/feedback/agents backend (Principle I).

## Technical Context

**Language/Version**: TypeScript 5, React 19.2, Next.js 16.2.9 (App Router, `output: "export"`)

**Primary Dependencies**: `streamdown` (+`@streamdown/code`, `@streamdown/mermaid`), `@microsoft/fetch-event-source` (streaming), native `fetch` for REST history/feedback/agents calls (axios is available but not required), `@tanstack/react-query` (wraps the REST calls: agents list query, history load, feedback/history mutations), `zod` + `@t3-oss/env-nextjs`, shadcn primitives via `@shadcn/react` (`message`, `bubble`, `message-scroller`, `select`/`textarea`) + `radix-ui`, Tailwind v4, `cn()`

**Storage**: Browser `localStorage` for local conversation persistence (fallback when no history API), degrading to in-memory if storage is unavailable. Remote history is the host's concern via the configured URL. No storage owned by this repo.

**Testing**: `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom`. Harness config is NOT yet present (no `vitest.config.*`/setup) → establishing it is the first task.

**Target Platform**: Modern evergreen browsers; the static export is served by a notebook/proxy host, a Databricks Apps wrapper, or manual copy — no server runtime.

**Project Type**: Static-export web frontend (UI-only). All code under `frontend/`.

**Performance Goals**: First streamed token visible within a few seconds against the mock (SC-001); incremental chunks render without jank (target ~60fps, no full-list re-render per token); cancel halts visible output within ~1s (SC-003).

**Constraints**: No secrets in the browser bundle (only `NEXT_PUBLIC_*`); static-export safe (no route handlers/server actions/cookies/request-time headers); every emitted file ≤ 10MB (9.5MB pre-deploy guard); UI-only (no backend, no auth).

**Scale/Scope**: One chat screen, one active session, with agent selector + feedback + reload-persistent history. ~8–9 new `lib` modules (chat core, sse, mock, stubs, history providers, feedback sinks, agents client, config), ~1–2 hooks, ~8 chat components, plus a committed sample recording and test fixtures.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Verdict | How this plan satisfies it |
|---|-----------|---------|----------------------------|
| I | UI-Only, No Backend | ✅ PASS | No backend/BFF/auth added. History/feedback/agents calls hit **host-provided** endpoints selected by public config; the repo owns no history/feedback/agent registry. The one live SSE transport streams a host-provided endpoint (real / proxy / dev mock-api script); the repo owns no chat backend. |
| II | No Secrets in Bundle | ✅ PASS | Config is only `NEXT_PUBLIC_*` URLs + transport mode (`env.ts`). No credentials embedded; auth (if any) is same-origin/cookie handled by the deployment wrapper, not this UI. Remote calls MAY use `credentials: "include"` but never carry a bundled secret. |
| III | Static-Export Safe | ✅ PASS | All I/O is client-side: streaming via `@microsoft/fetch-event-source`, REST via `fetch`, persistence via `localStorage`. Recording loaded as a static `public/` asset (in-app) or via fs (tests). No route handlers/server actions. |
| IV | Backends Only Through Adapters | ✅ PASS | Chat via the single `ChatTransport`; history via a `HistoryProvider` interface; feedback via a `FeedbackSink` interface; agents via an `AgentsClient` interface. Components never fetch directly — they call these abstractions. Final assistant state immutable; cache invalidation explicit. |
| V | Customization Is a Contract | ✅ PASS | New components forward `className` through trailing `cn(...)`, expose `data-slot`, and read theme tokens from `globals.css`. Endpoint URL/mode/path stay config. |
| VI | Test-First (NON-NEGOTIABLE) | ✅ PASS (planned) | Task 1 stands up the vitest harness. Pure units (SSE parser, reducer, send-queue) get failing tests before code; component behavior tested with Testing Library. |
| VII | Spec-Driven & Docs-as-Code | ✅ PASS | This plan + spec + forthcoming tasks under `.specify/specs/001-chat-mvp/`. Design consistent with existing ADRs; no new ADR required (adapters/streaming/markdown already decided). |

**Result**: All gates pass. No violations → Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
.specify/specs/001-chat-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── chat-transport.md   # ChatTransport interface + SSE recording format
│   └── config.md           # Public config (env) contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── app/
│   │   └── page.tsx                  # mounts <ChatScreen /> (replaces starter page)
│   ├── components/
│   │   ├── ui/                       # existing shadcn primitives (reused, not edited)
│   │   └── chat/                     # NEW — feature components
│   │       ├── chat-screen.tsx       # composition root: header(agent selector) + list + composer
│   │       ├── message-list.tsx      # maps conversation → Message/Bubble, autoscroll
│   │       ├── assistant-message.tsx # streamdown render + tool timeline + error + feedback
│   │       ├── user-message.tsx      # user bubble
│   │       ├── chat-composer.tsx     # textarea + send/cancel, queue-aware + agent dropdown
│   │       ├── tool-timeline.tsx     # tool-activity placeholder surface
│   │       ├── stream-error.tsx      # inline error notice
│   │       └── feedback-panel.tsx    # thumbs up/down + optional comment → sink prop
│   ├── hooks/
│   │   └── chat/
│   │       ├── use-chat.ts           # NEW — state machine: messages, streaming, queue, cancel, persistence
│   │       └── use-agents.ts         # NEW — agents list query + selection state
│   ├── lib/
│   │   ├── chat/                     # NEW — transport-agnostic core
│   │   │   ├── transport.ts          # ChatTransport port + createChatTransport(endpointUrl)
│   │   │   ├── reducer.ts            # pure stream-event → conversation reducer
│   │   │   └── queue.ts              # pure send-queue logic
│   │   ├── stream/                   # NEW — the single SSE handler
│   │   │   ├── sse.ts                # pure: parse recording text → events (frames + parser)
│   │   │   ├── responses.ts          # pure: Databricks Responses frame → ChatStreamEvent[]
│   │   │   └── sse-client.ts         # live SSE via @microsoft/fetch-event-source (+ same parser)
│   │   ├── history/                  # NEW — persistence
│   │   │   ├── provider.ts           # HistoryProvider interface + resolveHistory(config)
│   │   │   ├── local.ts              # localStorage provider (+ in-memory degrade)
│   │   │   └── remote.ts             # REAL remote provider (fetch to history URL)
│   │   ├── feedback/                 # NEW
│   │   │   ├── sink.ts               # FeedbackSink interface + resolveFeedback(config)
│   │   │   ├── remote.ts             # REAL POST to feedback URL
│   │   │   └── mock.ts               # no-op/local sink
│   │   ├── agents/                   # NEW
│   │   │   └── client.ts             # AgentsClient: REAL fetch agents list (id+name)
│   │   └── config.ts                 # NEW — reads env → typed capability config (URLs)
│   ├── entities/                     # EXISTING — data model (Message/parts, ChatRequest, ChatStreamEvent, config…)
│   ├── env.ts                        # EXTENDED — chat endpoint + history/feedback/agents URLs
│   └── lib/utils.ts                  # existing cn()
├── public/
│   └── recordings/
│       └── default.txt               # NEW committed sample recording (Databricks Responses SSE)
├── scripts/
│   └── mock-api.mjs                  # NEW dev-only mock-api: serves a recording as Databricks-format SSE
├── sse-recordings/                   # gitignored — optional local dev captures only
├── src/**/__tests__/                 # NEW colocated tests + fixtures (committed)
├── vitest.config.ts                  # NEW test harness config
└── vitest.setup.ts                   # NEW jest-dom setup
```

**Structure Decision**: Single static-export frontend (web frontend, UI-only — no
backend tree). Data types live in `src/entities/`; behavior ports + I/O in `src/lib/`.
Extends the target module map in [`ARCHITECTURE.md`](../../../ARCHITECTURE.md) with
sibling capability modules `src/lib/history`, `src/lib/feedback`, `src/lib/agents`
alongside `src/lib/chat` (transport port + reducer + queue) and `src/lib/stream` (the
single SSE handler: pure parser + live fetch-event-source client). There is **one** chat
transport (`createChatTransport(endpointUrl)`) — no mode/adapter selection; history/
feedback/agents each keep the `resolve*(config)` real-or-local shape. Dependency
direction stays `app → components → hooks → lib`; the pure core (SSE parser, Responses
mapper, reducer, queue, config resolution) stays I/O-free for cheap test-first coverage,
while the live transport and remote providers isolate `fetch`/SSE behind the interface
(tested with injected fetch / mocked fetch). The mock-api script is a dev tool outside
the app bundle.

## UI Redesign & App Shell (D-014b) — render-layer addendum

Added 2026-07-01 after the functional MVP shipped. A visual/UX pass only — **no change to
transport, reducer, or the interleaved `Message.parts[]` model**. Ports three references:
`lakemind` (chat-stream look: avatar + per-part rendering, rich collapsible per-tool rows with
icon/color by tool type, animating markdown caret), `chimai` (todo timeline aesthetic — dots
done/current/pending, "n/m done", collapsible), and `specdeck` (app shell: shadcn sidebar +
`next-themes` + settings dropdown). The todo timeline renders **on the composer** (user-expandable),
sourced from the newest `write_todos` call's list. Design: product UI, calm dev-tool language,
**one accent = Databricks brick-orange** on neutral, default theme **system**; `design-taste-frontend`
anti-slop rules (color/shape lock, full states, no AI-purple) apply, landing-page rules do not.
Static-export invariants hold (sidebar defaults open + client localStorage, no server cookie reads;
`next-themes` is client-only). Tasks: **T058–T067** (see `tasks.md` › Phase 9); this phase also
completes the still-open US5 selector (surfaced inside settings) and T057 (reasoning block).

## Complexity Tracking

> No Constitution Check violations. Section intentionally empty.
