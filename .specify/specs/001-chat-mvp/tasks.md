# Tasks: Chat MVP

**Input**: Design documents from `.specify/specs/001-chat-mvp/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUDED and write-first — Constitution Principle VI (Test-First, NON-NEGOTIABLE)
and the `tdd` rule require a failing test before production code for pure units and
component behavior.

**Organization**: Grouped by user story (priority order P1 → P2 → P3) so each ships as an
independent increment. All paths are under `frontend/`.

**Story priority order**: US1 (P1) → US2 (P2) → US4 (P2) → US3 (P3) → US5 (P3).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1..US5 (user-story phases only)

**Component convention (Principle V / FR-016 / SC-006) — acceptance for EVERY `frontend/src/components/chat/*` task** (T019–T023, T037, T038, T042, T047): the component MUST forward a consumer `className` via a trailing `cn(...)` (consumer classes win), expose a `data-slot`, and derive visual tokens (color/radius/font) from theme CSS variables — never hardcoded values.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test harness, deps, and public-config surface.

- [X] T001 Create vitest harness `frontend/vitest.config.ts` + `frontend/vitest.setup.ts` (jsdom, `@testing-library/jest-dom`), add `test`/`test:watch` scripts to `frontend/package.json`
- [X] T002 [P] Add/verify runtime deps in `frontend/package.json`: `streamdown` (+`@streamdown/code`, `@streamdown/mermaid`), `@microsoft/fetch-event-source`, `@tanstack/react-query`; confirm `zod` + `@t3-oss/env-nextjs` present; commit `pnpm-lock.yaml`
- [X] T003 [P] Extend `frontend/src/env.ts` with `NEXT_PUBLIC_TRANSPORT_MODE` + `NEXT_PUBLIC_{CHAT_ENDPOINT,HISTORY_API,FEEDBACK_API,AGENTS_API}_URL` (all optional, non-secret)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data entities, transport port, and config resolution that every story needs.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T004 Data-model entities created in `frontend/src/entities/` — `message.ts` (Message with `parts[]`, MessageStatus, ToolActivityItem, TextPart/ToolsPart/MessagePart), `conversation.ts`, `agent.ts`, `feedback.ts`, `config.ts` (TransportMode, CapabilityConfig), and `deepagents-tools/` (tool-call union + compact start/end). **DONE** (reviewed pre-tasks; `parts[]` interleaved timeline added after multi-burst-text review).
- [X] T005 Define neutral transport data types as **entities** in `frontend/src/entities/transport.ts`: `ChatRequest`/`ChatRequestMessage` and `ChatStreamEvent` (`token`/`reasoning`/`tool`/`error`/`done`) as zod schemas + inferred types; export from `entities/index.ts`. Per D12 the `tool` event carries raw `name` + parsed `args` (+ `status: running|done`); `reasoning` carries `delta`. (No `lib/chat/types.ts` — data model lives in entities.)
- [X] T006 Define `ChatTransport` + `ChatStreamHandlers` port and the SINGLE `createChatTransport(endpointUrl)` in `frontend/src/lib/chat/transport.ts` — no modes/`resolveTransport`. It wraps the live SSE client (T016). Endpoint missing ⇒ `send` throws (surfaced inline, T055).
- [X] T007 Config resolver `frontend/src/lib/config.ts`: read `env.ts` → validated `CapabilityConfig` (via `entities/config.ts`) — `chatEndpointUrl` + independent history/feedback/agents URLs (no `transportMode`); `isChatEndpointMissing()` helper (D8)

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 - Ask and receive a streamed answer (Priority: P1) 🎯 MVP

**Goal**: Send a message; user bubble appears instantly; assistant reply streams token-by-token and settles into rendered markdown/code. Extra sends queue and auto-dispatch.

**Independent Test**: Load app on mock transport, send a message → user message shows immediately, assistant streams in and renders markdown + a code block; a second send while streaming queues and auto-sends after.

### Tests for User Story 1 (write first — must FAIL before impl) ⚠️

- [X] T008 [P] [US1] SSE + Responses-parser tests in `frontend/src/lib/stream/__tests__/` — `sse.test.ts` (frames → events on Databricks recordings, `[DONE]` accepted, keepalive/lifecycle/malformed ignored) + `responses.test.ts` (`createResponsesParser`: output_text→token, reasoning→reasoning, function_call/output→tool paired by call_id, message→done, error frame, unknown ignored)
- [X] T009 [P] [US1] Reducer tests in `frontend/src/lib/chat/__tests__/reducer.test.ts` — token append grows the active trailing `text` part, `done` → complete + clears active + drops empty-after-trim text parts, only one streaming at a time
- [X] T010 [P] [US1] Send-queue tests in `frontend/src/lib/chat/__tests__/queue.test.ts` — FIFO enqueue while streaming, auto-dispatch on terminal, empty/whitespace rejected (no message, no request)
- [X] T011 [P] [US1] Live-transport test in `frontend/src/lib/stream/__tests__/sse-client.test.ts` — inject a fake `fetch` streaming a Databricks recording; assert mapped events in order + terminal `done`, honors abort. (Replaces the old in-app mock-transport test.)

### Implementation for User Story 1

- [X] T012 [US1] Pure `parseRecording(text)` + `extractDataPayloads(text)` in `frontend/src/lib/stream/sse.ts` and `createResponsesParser()` in `frontend/src/lib/stream/responses.ts` (Databricks Responses → `ChatStreamEvent`); no I/O
- [X] T013 [US1] Pure stream-event → conversation reducer in `frontend/src/lib/chat/reducer.ts` — assembles `Message.parts[]` from event order: `token` → append to trailing `text` part; on `done` drop empty-after-trim `text` parts (tool interleaving added in US3/T036)
- [X] T014 [US1] Pure send-queue logic in `frontend/src/lib/chat/queue.ts`
- [X] T015 [US1] Dev-only **mock-api script** `frontend/scripts/mock-api.mjs` — HTTP server that serves `public/recordings/default.txt` as `text/event-stream` in Databricks Responses format, small per-event delay (text fast, tool slower), abort-aware; add a `pnpm mock:api` script. FE points `NEXT_PUBLIC_CHAT_ENDPOINT_URL` at it.
- [X] T016 [US1] Live SSE client `frontend/src/lib/stream/sse-client.ts` — `streamSSE({url,body,handlers,fetchImpl?})` over `@microsoft/fetch-event-source` + shared `createResponsesParser()` (lakemind `agent-stream.ts` pattern: onopen content-type check, `[DONE]` terminal, onerror rethrow to stop retry, idempotent close). `createChatTransport` (T006) wraps it.
- [X] T017 [P] [US1] Committed sample recording `frontend/public/recordings/default.txt` in **Databricks Responses SSE** format (interleaved: reasoning → text → tool → text so `parts[]` timeline is exercised; markdown/code)
- [X] T018 [US1] `use-chat` hook in `frontend/src/hooks/chat/use-chat.ts` — messages, single active generation, send-queue, injected clock (cancel added in US2)
- [X] T019 [US1] Composition root `frontend/src/components/chat/chat-screen.tsx` (list + composer; header wired later)
- [X] T020 [P] [US1] `message-list.tsx` in `frontend/src/components/chat/` — map conversation → Message/Bubble + autoscroll
- [X] T021 [P] [US1] `user-message.tsx` in `frontend/src/components/chat/`
- [X] T022 [P] [US1] `assistant-message.tsx` in `frontend/src/components/chat/` — iterate `Message.parts[]`, render `text` parts via `streamdown` markdown/code (US1 turns are text-only; `tools` part rendering + error/feedback slots added in US3)
- [X] T023 [US1] `chat-composer.tsx` in `frontend/src/components/chat/` — textarea + send, empty/whitespace guard, queue-aware disabled state
- [X] T024 [US1] Mount `<ChatScreen/>` in `frontend/src/app/page.tsx` and fix `frontend/embed/main.tsx` import (currently references missing `chat-screen`)
- [X] T055 [US1] Missing/invalid transport config → clear, non-crashing inline notice (spec Edge Cases): when a networked mode is selected but `chatEndpointUrl` is unset, or `resolveTransport` returns a stub that throws on `send`, surface a readable inline message in `frontend/src/components/chat/chat-screen.tsx` (self-contained; do NOT depend on US3's `stream-error.tsx`) instead of failing silently — mock mode needs no endpoint. Add a failing test in `frontend/src/hooks/chat/__tests__/use-chat.config.test.ts`

**Checkpoint**: US1 fully functional against mock — shippable MVP.

---

## Phase 4: User Story 2 - Cancel a generation in progress (Priority: P2)

**Goal**: Stop an in-flight stream; partial reply retained + marked stopped; composer re-enabled.

**Independent Test**: Start a generation, cancel mid-stream → streaming halts within ~1s, partial content stays, status `stopped`, composer ready; cancel is idempotent and offered only while streaming.

### Tests for User Story 2 (write first) ⚠️

- [X] T025 [P] [US2] Cancel tests in `frontend/src/hooks/chat/__tests__/use-chat.cancel.test.ts` — abort → `stopped` + partial kept, idempotent at start/end, queued message not silently dropped

### Implementation for User Story 2

- [X] T026 [US2] Add abort/cancel to `frontend/src/hooks/chat/use-chat.ts` (AbortController per generation; terminal → dequeue next)
- [X] T027 [US2] Cancel affordance in `frontend/src/components/chat/chat-composer.tsx` — shown only while streaming

**Checkpoint**: US1 + US2 both work independently.

---

## Phase 5: User Story 4 - Conversation history that survives reloads (Priority: P2)

**Goal**: Conversation persists across reload — remote history provider when a URL is set, else `localStorage`, degrading to in-memory; failures fall back without crashing.

**Independent Test**: No history URL → chat, reload, restored from localStorage. History URL set → loads on startup + saves on terminal turn; simulate failing call → falls back to local, session intact.

### Tests for User Story 4 (write first) ⚠️

- [X] T028 [P] [US4] History tests in `frontend/src/lib/history/__tests__/` — local persist/restore, remote load/save (mocked fetch), failure → fallback-to-local, corrupt/unreadable → clean session, storage-unavailable → in-memory

### Implementation for User Story 4

- [X] T029 [US4] `HistoryProvider` interface + `resolveHistory(config)` in `frontend/src/lib/history/provider.ts`
- [X] T030 [P] [US4] Local provider (`localStorage` + in-memory degrade) in `frontend/src/lib/history/local.ts`
- [X] T031 [P] [US4] Remote provider (real fetch to history URL, runtime failover to local) in `frontend/src/lib/history/remote.ts`
- [X] T032 [US4] Wire load-on-startup + save-on-terminal-turn into `frontend/src/hooks/chat/use-chat.ts`
- [X] T033 [US4] New-conversation replaces persisted state (no stale resurrection) in `use-chat.ts` / provider

**Checkpoint**: US1 + US2 + US4 independently functional.

---

## Phase 6: User Story 3 - See tool activity, errors, and give feedback (Priority: P3)

**Goal**: Tool-activity timeline placeholder, inline stream errors, and thumbs up/down + optional comment to a configurable sink (no-op mock when unset).

**Independent Test**: Drive mock to emit a tool event, an error frame, and a normal completion → timeline shows tool activity distinct from prose, error renders inline without crash, feedback submit calls the sink (or mock) and reflects selection.

### Tests for User Story 3 (write first) ⚠️

- [X] T034 [P] [US3] Reducer tests in `frontend/src/lib/chat/__tests__/reducer.tools.test.ts` — `tool` event upserts `ToolActivityItem` by `call_id` into the trailing `tools` part (open new when last part is `text`; raw name + parsed args); a token after a `tools` part opens a fresh `text` part (interleaved timeline, multi-burst); `error` frame → status `error` with parts kept
- [X] T035 [P] [US3] Feedback sink tests in `frontend/src/lib/feedback/__tests__/` — remote POST (mocked fetch), mock no-op when unset, failure non-blocking + selection retained

### Implementation for User Story 3

- [X] T036 [US3] Extend reducer for `tool` upsert + `error` frame in `frontend/src/lib/chat/reducer.ts` — append/upsert `ToolActivityItem` into the trailing `tools` part (open new when last part is `text`), preserving text↔tool order; classify via `entities/deepagents-tools` `parseToolCall` (unknown → generic)
- [X] T037 [P] [US3] `tool-timeline.tsx` in `frontend/src/components/chat/` — renders one `tools` part's `ToolActivityItem[]` as a collapsible activity block, visually distinct
- [X] T038 [P] [US3] `stream-error.tsx` in `frontend/src/components/chat/` — inline error notice
- [X] T039 [US3] `FeedbackSink` interface + `resolveFeedback(config)` in `frontend/src/lib/feedback/sink.ts`
- [X] T040 [P] [US3] Remote feedback sink (real POST) in `frontend/src/lib/feedback/remote.ts`
- [X] T041 [P] [US3] No-op/local mock sink in `frontend/src/lib/feedback/mock.ts`
- [X] T042 [US3] `feedback-panel.tsx` in `frontend/src/components/chat/` — thumbs + optional comment → sink prop, single-choice toggle
- [X] T043 [US3] Wire into `frontend/src/components/chat/assistant-message.tsx` — render `Message.parts[]` in order (`text` → markdown/streamdown, `tools` → tool-timeline block) so text and tool activity interleave chronologically; plus stream-error + feedback-panel

**Checkpoint**: US1–US4 + US3 independently functional.

---

## Phase 7: User Story 5 - Choose which agent to chat with (Priority: P3)

**Goal**: When an agents URL is set, list agents and let the user pick; selected `agentId` rides each request. No URL / failure / empty → selector hidden, default endpoint.

**Independent Test**: Agents URL returns a list → selector shows agents, picking one adds its id to subsequent requests. No/failing URL → selector hidden, chat still works.

### Tests for User Story 5 (write first) ⚠️

- [X] T044 [P] [US5] Agents tests in `frontend/src/hooks/agents/__tests__/use-agents.test.ts` — list fetch (mocked), empty/failure → `available:false` + hidden, previously-selected agent gone on refetch → resets to null
- [X] T045 [US5] `AgentsClient.list()` (real GET agents id+name) in `frontend/src/lib/agents/client.ts`
- [X] T046 [US5] `use-agents` hook (TanStack Query list + selection state) in `frontend/src/hooks/agents/use-agents.ts`
- [X] T047 [US5] agent selector dropdown in `frontend/src/components/chat/chat-composer.tsx` — shows a default "Agent" option when no agents
- [X] T048 [US5] Include `selectedId` as `ChatRequest.agentId` in `use-chat.ts`

**Checkpoint**: All five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T049 [P] Docs sync: update `ARCHITECTURE.md` to reflect data models in `frontend/src/entities/`, the single SSE handler in `src/lib/stream/` (no `databricks/` adapters), and the dev mock-api script. (`plan.md` structure already updated in the pivot.)
- [X] T050 [P] Contract reconcile: `contracts/chat-transport.md` rewritten to the no-modes single-endpoint + Databricks Playground SSE format + mock-api architecture (supersedes the old modes/`resolveTransport`/stub-adapters contract)
- [X] T051 Static-export build guard: `pnpm --dir frontend build` succeeds and every emitted file ≤ 9.5MB
- [X] T052 Run `quickstart.md` validation end-to-end against the mock-api script
- [X] T053 [P] Edge-case pass: long unbroken output / long code lines wrap-or-scroll (no layout break); basic a11y on composer + selector
- [X] T054 [P] Tech-debt entries in `docs/tech-debt-tracker.md` — `chat-completions` (legacy shape) not yet mapped by the single SSE handler; deferred rich per-tool widgets beyond placeholder (D12)
- [X] T056 [P] Customization-contract audit (Principle V / FR-016 / SC-006): verify EVERY `frontend/src/components/chat/*` forwards `className` via trailing `cn(...)`, exposes `data-slot`, and uses theme CSS variables (no hardcoded color/radius/font) — confirms a consumer can restyle + repoint without editing component source
- [X] T057 [P] Reasoning ("thinking") support (forward-compatible; Databricks reasoning models — see `docs/references/databricks-research.md` › Reasoning): (a) reducer handles the `reasoning` event → appends to a trailing `reasoning` `MessagePart` (opens new when last part differs), drops empty-after-trim on `done` — add test in `frontend/src/lib/chat/__tests__/reducer.reasoning.test.ts`; (b) `reasoning-block.tsx` (now `activity-group.tsx` / `ReasoningText`) in `frontend/src/components/chat/` — collapsible, collapsed by default, visually distinct from answer text (forwards `className` via `cn(...)`, `data-slot`, theme vars); (c) `assistant-message.tsx` renders `reasoning` parts inline in `parts[]` order; (d) add a `reasoning` fixture recording to exercise the path (deepagents default recording has none)

---

## Phase 9: UI Redesign & App Shell (D-014b)

**Goal**: Lift the shipped chat surface from "functional" to a polished, themeable dev-tool
UI without changing transport/reducer logic. Ports the visual language of `lakemind` (chat
stream), the todo timeline aesthetic of `chimai` (rendered on the composer), and the app
shell of `specdeck` (sidebar + theme). Design read: **product UI**, calm dev-tool language,
**one accent = Databricks brick-orange** on a neutral base, `next-themes` default **system**.
Anti-slop principles from the `design-taste-frontend` skill apply (color/shape lock, full
interactive states, no AI-purple); landing-page rules (hero/bento/marquee) do not.

**Constraints preserved**: static-export-safe (no server-side cookie reads — sidebar defaults
open + client localStorage), UI-only, every `components/**` task keeps the Component convention
(trailing `cn(className)`, `data-slot`, theme CSS vars — no hardcoded color/radius/font). The
interleaved `Message.parts[]` model is unchanged; this is render-layer only.

- [X] T058 Theme tokens in `frontend/src/app/globals.css`: add a single **brick-orange** accent
  (`--primary`/`--ring`/sidebar-primary, light + `.dark`, WCAG-AA foreground) on the existing
  neutral base, plus semantic state tokens (`--good`/`--warn`/`--crit`/`--running`) surfaced via
  `@theme inline`. Keep one radius scale. Clean up `frontend/src/app/layout.tsx`: drop the
  duplicate Inter font, keep Geist sans + mono, fix `metadata` (title/description), add
  `suppressHydrationWarning` for next-themes.
- [X] T059 `next-themes`: `frontend/src/components/theme/theme-provider.tsx` (client wrapper,
  `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`) +
  `theme-toggle.tsx` (sun/moon ghost button, both icons in SSR, no mounted effect). Mount provider
  in `layout.tsx`. Static-export-safe (client-only; anti-FOUC script is fine under export).
- [X] T060 `tool-meta.ts` in `frontend/src/components/chat/` — map each deepagents tool name →
  `{ icon, color, title, subtitle }`, deriving human labels from the **validated structured args**
  (`entities/deepagents-tools`): `read_file`→file_path, `write_file`/`edit_file`→file_path,
  `execute`→command, `grep`→pattern, `glob`→pattern, `ls`→path, `task`→description,
  `write_todos`→count, `compact_conversation`→"Compacting". Unknown tool → neutral fallback. Pure
  fn + unit test `__tests__/tool-meta.test.ts`.
- [X] T061 Redesign `tool-timeline.tsx` → per-tool rich rows (lakemind pattern): icon+color from
  T060, title/subtitle, status (spinner `running` / check `done` / alert on error), each row a
  `Collapsible` revealing args/output payload (`<pre>` mono, max-height scroll). Keep the outer
  "N calls / Using tools…" summary. Update `reducer.tools.test`-adjacent component test
  `__tests__/tool-timeline.test.tsx`.
- [X] T062 Redesign `assistant-message.tsx` + `user-message.tsx`: assistant renders `parts[]` in
  order — `text`→`Streamdown` (with `@streamdown/code` + `@streamdown/mermaid` plugins, animating
  caret while streaming), `tools`→T061 block, `reasoning`→T057 block; avatar + left-aligned column.
  User → right-aligned bubble (`bg-primary`/`text-primary-foreground`) + avatar. Update the
  existing `assistant-message.test.tsx`.
- [X] T063 Redesign `chat-composer.tsx` to the lakemind input pill (rounded, focus ring/shadow,
  send↔stop swap) and host the todo strip (T064) directly above the textarea within the same card.
  Keep Enter-sends / Shift+Enter-newline / blank-guard / busy-queue behavior + `chat-composer.test`.
- [X] T064 [P] `lib/chat/todos.ts` — pure `selectLatestTodos(messages)` picking the newest
  `write_todos` call's `todos[]` from `parts[].tools[]` (replace-whole-list); unit test. Then
  `todo-card.tsx` in `frontend/src/components/chat/` — chimai timeline aesthetic (dot
  done/current-pulse/pending, "n/m done" header, `Collapsible` **expandable by the user**,
  staggered reveal), rendered on the composer via T063. Hidden when no todos. Component test.
- [X] T065 App shell: `frontend/src/components/shell/app-sidebar.tsx` (shadcn `sidebar.tsx`,
  `collapsible="icon"`) — brand header, **New chat** action (calls `useChat().newConversation`),
  **conversation history** group from the existing `HistoryProvider` (list/select/rename-less MVP),
  footer with `nav-settings` (T066) + `theme-toggle`. `app-shell.tsx` composes `SidebarProvider`
  (`defaultOpen` const + client localStorage restore — no server cookie) + `SidebarInset`. Rewire
  `frontend/src/app/page.tsx` to mount the shell around `ChatScreen`.
- [X] T066 `frontend/src/components/shell/nav-settings.tsx` — dropdown: **Appearance** (light/dark/
  system radio → `next-themes`), endpoint/agent info, and the **US5 agent selector** (T047) surfaced
  here instead of a bare header control. In-session-only prefs are mock state.
- [X] T067 [P] Redesign verification: `pnpm --dir frontend exec tsc --noEmit` clean, all component +
  reducer tests green, static build has no `out/api`; re-run the T056 customization-contract audit
  over the new `components/shell/*` + `components/chat/*`; confirm a11y (focus ring, `aria-label`s,
  reduced-motion respected) and light/dark parity.
- [X] T068 Single-font migration: drop Geist entirely — `layout.tsx` now loads only
  `Inter({ variable: "--font-sans" })`; `globals.css` `--font-mono` is the platform monospace
  stack (no second webfont). Supersedes T058's "keep Geist sans + mono" (superseded 2026-07-02,
  see Notes).
- [X] T069 Empty-state redesign (`frontend/src/components/chat/chat-empty.tsx`): centered greeting
  + `NEXT_PUBLIC_SAMPLE_PROMPTS`-driven grid of starter cards (default icon + prompt text, click
  sends immediately); no samples ⇒ greeting only. New config fields `samplePrompts`/`uploadEnabled`
  on `CapabilityConfig` (both `.optional()`, defaulted at the consumption site) plus
  `NEXT_PUBLIC_SAMPLE_PROMPTS`/`NEXT_PUBLIC_ENABLE_UPLOAD` in `env.ts`, parsed via
  `parseSamplePrompts`/`parseUploadEnabled` in `lib/config.ts` (malformed ⇒ safe default, never
  throws). Tests: `lib/__tests__/config.test.ts`, `components/chat/__tests__/chat-empty.test.tsx`.
- [X] T070 Composer toolbar relocation: moved the **US5 agent selector** (T047) from the
  `nav-settings.tsx` dropdown (T066) into a toolbar row under the textarea in
  `chat-composer.tsx`, alongside a new upload/attach button gated by `NEXT_PUBLIC_ENABLE_UPLOAD`
  (default off; dimmed + disabled with a tooltip when off — upload itself stays deferred, D-014).
  The dropdown always renders (placeholder "Agent" item when `agentsAvailable` is false); the
  toolbar's local `TooltipProvider` makes `ChatComposer` renderable standalone, not dependent on
  an ancestor `AppShell` (customization contract). Supersedes T066's "surfaced here [nav-settings]
  instead of a bare header control" (superseded 2026-07-02, see Notes). Tests:
  `hooks/agents/__tests__/use-agents.test.ts`, `hooks/chat/__tests__/use-chat.agent.test.ts`,
  new cases in `components/chat/__tests__/chat-composer.test.tsx`.
- [X] T071 File/image attachment (supersedes D-014's upload deferral and T070's "upload
  itself stays deferred" note, superseded 2026-07-02, see Notes): the composer's attach
  button reads picked files client-side (`FileReader` → base64 data URL, no backend)
  into a new `Attachment` entity (`id`, `name`, `mimeType`, `size`, `dataUrl`) — one
  uniform shape for every file type, no per-vendor branching (kept simple per explicit
  scope direction, rather than the vendor-specific `image_url`/`document` shaping
  researched in `docs/references/databricks-research.md`). `Message.attachments` (always
  an array, mirrors `parts`) renders as removable preview chips in the composer
  (`chat-composer.tsx`) and filename+size chips in the sent bubble (`user-message.tsx`)
  — no thumbnails, no client-side content parsing. `ChatRequestMessage.attachments`
  (`.optional()`) carries them to the transport **only on the turn being dispatched** —
  replayed history (and other still-queued turns) never re-attach prior files, bounding
  payload growth per send (`use-chat.ts` `send`/`handleClose`). `NEXT_PUBLIC_UPLOAD_ACCEPT`
  (default `image/*`) and `NEXT_PUBLIC_UPLOAD_MAX_SIZE_MB` (default 10 MB, i.e.
  `MAX_ATTACHMENT_SIZE_BYTES`) drive validation in `lib/chat/attachments.ts`
  (`validateAttachment`/`matchesAccept`). Attachments are session-only:
  `lib/history/local.ts` strips each `dataUrl` before persisting to `localStorage` (chips
  still render from name/size after reload; file bytes do not survive it). `Conversation.queue`
  moved from `string[]` to `QueuedMessage[]` (`{text, attachments}`) so a message queued
  behind an active generation keeps its attachments. Tests:
  `lib/chat/__tests__/attachments.test.ts`, `lib/chat/__tests__/queue.test.ts`,
  `lib/history/__tests__/local.test.ts`, `lib/__tests__/config.test.ts`, new cases in
  `components/chat/__tests__/chat-composer.test.tsx`,
  `components/chat/__tests__/user-message.test.tsx` (new file).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no deps.
- **Foundational (P2)**: after Setup — BLOCKS all stories. (T004 already done.)
- **User stories (P3–P7)**: each after Foundational; then independent. Recommended priority order US1 → US2 → US4 → US3 → US5.
- **Polish (P8)**: after the stories you intend to ship.

### Story dependencies

- **US1 (P1)**: after Foundational. No story deps. Establishes reducer/hook/components the others extend.
- **US2 (P2)**: extends `use-chat` + composer from US1.
- **US4 (P2)**: adds history providers; wires into `use-chat`. Independently testable.
- **US3 (P3)**: extends reducer (tool/error) + assistant-message; adds feedback sink. Independently testable.
- **US5 (P3)**: adds agents client/hook/selector; wires `agentId`. Independently testable.

### Within a story

- Tests written and FAILING before implementation (Principle VI).
- Pure core (parser/reducer/queue) before hook; hook before components; components before wiring.

### Parallel opportunities

- Setup: T002, T003 in parallel.
- US1 tests T008–T011 in parallel; then components T020/T021/T022 in parallel; live SSE client T016 + recording T017 + mock-api T015 in parallel with core.
- Providers within a story are [P] (US4 T030/T031; US3 T037/T038/T040/T041).
- With capacity, US2/US4/US3/US5 proceed in parallel once US1 lands.

---

## Parallel Example: User Story 1

```bash
# Tests first, together:
Task: "SSE parser tests in frontend/src/lib/stream/__tests__/sse.test.ts"
Task: "Reducer tests in frontend/src/lib/chat/__tests__/reducer.test.ts"
Task: "Send-queue tests in frontend/src/lib/chat/__tests__/queue.test.ts"
Task: "Live SSE client test in frontend/src/lib/stream/__tests__/sse-client.test.ts (injected fetch)"

# Then presentational components, together:
Task: "message-list.tsx"
Task: "user-message.tsx"
Task: "assistant-message.tsx"
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & validate** (independent test) → demo.

### Incremental delivery

Add US2 → US4 → US3 → US5, each tested independently and deployable, without breaking prior stories.

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- T004 is pre-done (entities reviewed before tasks); leave checked.
- **Architecture pivot (2026-07-01)**: removed transport "modes". FE always streams ONE endpoint in Databricks Playground SSE format via one live transport (`createChatTransport` → `streamSSE` over `@microsoft/fetch-event-source`) + one shared parser (`createResponsesParser`). "Mock" is a dev-only mock-api script (T015), not an in-app mode; deleted `src/lib/databricks/*` (mock + stub adapters) and `NEXT_PUBLIC_TRANSPORT_MODE`/`mockRecordingUrl`. Pattern ported from `lakemind/frontend/lib/api/agent-stream.ts`. See spec Clarifications 2026-07-01 (architecture pivot).
- Deepagents tool schemas (incl. compact start/end) are used in 001 via the reducer/parser classification path (mock-api recording + live stream share it).
- Commit per task or logical group; verify tests fail before implementing (Principle VI).
- Post-`/speckit-analyze` additions: **T055** (US1 — missing-config non-crash notice, closes edge-case gap U1) and **T056** (Polish — customization-contract audit, closes Principle V/FR-016 gap C1); plus the Component convention callout after the Format legend.
- **Interleaved timeline (`Message.parts[]`)**: after the multi-burst-text review (real capture streams text 3× around 24 tool calls under one `item_id`), `Message` moved from `content: string` + `tools[]` to an ordered `parts[]` (`text` / `tools`). Reducer builds parts from event order (no `item_id` on `ChatStreamEvent`); empty text parts dropped on `done`. Touches T009/T013 (US1 text parts), T034/T036 (US3 tool parts + interleave), T022/T037/T043 (render in order), and T017 (interleaved sample). See `data-model.md` › MessagePart.
- **Reasoning / "thinking" channel**: research (`docs/references/databricks-research.md` › Reasoning) confirmed Databricks reasoning is a separate content type (`response.reasoning_text.delta` / `item.type "reasoning"`, or FM-API `content` block `type:"reasoning"`), rendered as a collapsible Thinking block. Added `reasoning` to `ChatStreamEvent` (T005) + contract, a `reasoning` `MessagePart` (`ReasoningPartSchema`), and **T057** (Polish, forward-compatible). The single SSE handler maps `reasoning` for both the live stream and mock-api recordings; the committed recording now includes a leading reasoning burst.
- **Font/toolbar follow-up (2026-07-02)**: T068 supersedes T058's "keep Geist sans + mono" — the
  app now ships a single Inter face (`--font-sans`), Geist removed entirely, `--font-mono` is the
  platform monospace stack. T070 supersedes T066's "[US5 selector] surfaced here [nav-settings]
  instead of a bare header control" — the selector now lives in the composer toolbar next to the
  new upload button, matching other AI chat platforms' layout. Non-secret env template committed
  at `frontend/.env.example`; `docker-compose.yml`'s `web` service reads `env_file: frontend/.env`
  (gitignored, user-owned) instead of the `environment:` block growing per new var.
- **Auth research (2026-07-02)**: `docs/references/databricks-auth-user-identity.md` — how to
  surface the logged-in user in the sidebar across the two "server owns the origin" deploy modes
  (notebook + cluster driver-proxy; Databricks Apps). Conclusion: the browser bundle can never
  read platform identity headers or call the workspace REST API directly (CORS-blocked); both
  modes need a same-origin `GET /api/me`-style endpoint from the hosting backend, following the
  existing `agentsUrl`-style provider pattern (`historyUrl`/`feedbackUrl`/`agentsUrl` →
  `userUrl`). Not yet implemented — no `UserProvider` exists in this feature; tracked as future
  work, not a task here.
- **File/image attachment (2026-07-02)**: initial design explored a Databricks
  Playground/Model-Serving-specific wire shape (`image_url`/`document` `ContentItem`
  mapping per adapter, generic pass-through only for custom App/proxy backends) — see
  `docs/references/databricks-research.md`. User direction (`tiếp theo upload đơn giản
  không cần feat riêng`) was to keep this addition simple and fold it into 001 rather
  than open a new Spec Kit feature folder: one uniform `Attachment` shape for every
  backend/file type (T071), no per-vendor branching in the UI/entities layer. If a
  strict Databricks Chat Completions `image_url`/`document` adapter is ever built, it
  can re-shape `ChatRequestMessage.attachments` at the transport boundary without
  touching entities or components — the door researched in `databricks-research.md`
  stays open, just not built now.
- **Queue/messages decoupling (2026-07-02, part of T071)**: `Conversation.queue` now
  holds still-waiting sends *independently* of `messages`, which contains only turns
  already dispatched to the backend (`QueuedMessage` gained an `id` for stable render
  keys). Pending "queued" bubbles are a derived render view in `useChat`
  (`messages + queue.map(toPending)`), not stored in `conversation.messages`. This
  fixed a real leak: `handleClose` previously built dispatch history from all of
  `messages` — including later still-queued turns — so a queued turn's text leaked into
  an earlier turn's request and was then sent again as its own turn. Removing the
  `dispatchedFound`/"promote first queued" logic; history is now `real messages + the
  one dequeued turn`. `queue` is transient and never persisted — `lib/history/local.ts`
  drops it to `[]` on save (outright, not relying on the drain-before-idle invariant).
- **Assistant markdown: base64 images + reference-link streaming fix (2026-07-02)**:
  Streamdown (`rehype-harden`) hard-blocks `data:` image URIs and exposes no opt-in prop
  (verified by rendering probes — `allowedImagePrefixes`/`allowDataImages` are ignored in
  2.5). So an agent-streamed inline base64 image (e.g. a chart, as in the
  `rbg-performance-2026` recording) rendered as "[Image blocked]". Fix: render those
  images OURSELVES, outside Streamdown — `lib/markdown/data-images.ts` (`splitDataImages`)
  splits the text at each `![alt](data:image/…)`; `assistant-message.tsx` hands the
  surrounding markdown to Streamdown and draws each image with a plain `<img>`. Scope
  limited to `data:image/…` (passive via `<img>`, no script), so Streamdown's block is
  not globally relaxed. Separately, reference-style links (`[text][ref]` + a trailing
  `[ref]: url` definition, resolved to inline links by `lib/markdown/reference-links.ts`)
  rendered as raw source right after streaming and only corrected on reload: Streamdown
  caches parsed blocks across incremental frames, and the definition-stripping rewrites
  block structure late in the stream, leaving stale blocks. Fix: the Streamdown `key`
  includes the streaming state, forcing a clean re-parse when a turn settles (matches the
  fresh-mount / reload render, which was already correct). Charts in the demo recording
  are PNGs drawn with Pillow (matplotlib unavailable), base64-embedded.
- **Font fallback + base-path relative endpoints (2026-07-02)**: (1) The UI font
  (`next/font/google` Inter) fell back to the browser default serif (Times New Roman) in
  an embed/offline build because the `--font-sans` chain had no generic fallback. Added
  `ui-sans-serif, system-ui, …, sans-serif` (fallback inside `var()` so an unset var can't
  invalidate the declaration) — worst case is a system sans-serif, never serif. (2)
  Endpoint URLs are now resolved against the app's runtime base path
  (`lib/config.ts › resolveDeploymentUrl`, applied in `resolveConfig` to
  chat/history/feedback/agents): a root-relative `/api/chat` reaches
  `domain.com/path/proxy/api/chat` when the app is mounted under that subpath, so ONE
  static build serves any mount point. Absolute/protocol-relative URLs bypass. See
  `contracts/config.md`.
- **Identity chip + mock `me` endpoint (2026-07-03)**: New host-provided endpoint
  `NEXT_PUBLIC_ME_API_URL` — a `GET` returning the current user as JSON
  (`email` + `username` required; `user_id`/`session_id`/`auth_type` (`DB_SAML_SSO` | `PAT`)
  /`org_id` optional). Mirrors the `agents` capability end-to-end: `entities/identity.ts`
  (zod `IdentitySchema`) → `lib/identity/{client,remote}.ts` (`resolveIdentity` port, remote
  fetch with `credentials: "include"`, throws on non-2xx / bad payload) → `hooks/identity/
  use-identity.ts` (load-once) → `components/shell/nav-identity.tsx`, a shadcn `NavUser`-style
  chip at the bottom of the sidebar footer (seeded DiceBear avatar, username + email, dropdown
  listing the optional fields present). When `meUrl` is unset or the fetch fails it renders a
  fixed **anonymous** placeholder rather than disappearing. Display-only — identity is never
  sent to the chat backend (Principle I/II). Dev mock: `app/api/me/route.dev.ts` (dev-only,
  `.dev.ts` gated out of the static export; needs `export const dynamic = "force-static"`
  because a bare `GET` under `output: export` must be statically renderable — unlike the POST
  chat mock). Default `.env` points `/api/me` at it.
