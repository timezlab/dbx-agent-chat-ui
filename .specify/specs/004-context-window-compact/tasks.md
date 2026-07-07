---
description: "Task list for Context-Window Meter & Manual /compact"
---

# Tasks: Context-Window Meter & Manual /compact

**Input**: [spec.md](./spec.md) + [plan.md](./plan.md)

**Tests**: INCLUDED — constitution VI (Test-First) + spec SC-005 require unit/component tests
for every acceptance scenario. Write each test FIRST and see it fail for the expected reason
before the implementation task.

**Organization**: grouped by user story. US1 (meter) is the standalone MVP; the thin-request
foundation lands before US2 so compaction actually reduces occupancy; US3 (suggester) layers
on top and US2 stays usable via the toolbar button if US3 slips.

## Format: `[ID] [P?] [Story] Description`

- **[P]** = different files, no dependency → can run in parallel.
- **[Story]** = FND (foundational), US1, US2, US3, POL (polish).

---

## Phase 1: Setup

- [ ] T001 Create branch `004-context-window-compact` from `main`.

---

## Phase 2: Foundational plumbing — `contextWindow` schema + config (blocks US1 & US2)

**Purpose**: make the backend context limit and per-turn `context_window` flow end-to-end.

### Tests first

- [ ] T002 [P] [FND] Test `parseContextWindow` in `frontend/src/lib/__tests__/config.test.ts`
  (create if absent): unset ⇒ `200000`; `"128000"` ⇒ `128000`; non-numeric/`"0"`/negative ⇒
  `200000`.
- [ ] T003 [P] [FND] Test in `frontend/src/lib/chat/__tests__/responses.test.ts`: `extractUsage`
  maps `usage.context_window` (and `usage.max_tokens` alias) → `contextWindow`; absent ⇒ field
  omitted.
- [ ] T004 [P] [FND] Test in the reducer test file: a `usage` event with `contextWindow` folds
  onto `Message.metrics.contextWindow` via `mergeMetrics` (keep-present-only).

### Implementation

- [ ] T005 [P] [FND] Add `contextWindow: z.number().optional()` to `MessageMetricsSchema`
  (`frontend/src/entities/message.ts`) and to the `usage` variant of `ChatStreamEventSchema`
  (`frontend/src/entities/transport.ts`), with a snake_case-vs-camelCase note.
- [ ] T006 [P] [FND] In `extractUsage` (`frontend/src/lib/chat/responses.ts`) map
  `usage.context_window ?? usage.max_tokens` → `contextWindow` (makes T003 pass).
- [ ] T007 [FND] In `mergeMetrics` (`frontend/src/lib/chat/reducer.ts`) add the
  `contextWindow` fold line (makes T004 pass; depends T005).
- [ ] T008 [FND] Config trio (mirror `usageEnabled`): add `NEXT_PUBLIC_CONTEXT_WINDOW`
  (`frontend/src/env.ts` client + runtimeEnv), `contextWindow?: number`
  (`frontend/src/entities/config.ts`), and `parseContextWindow` (default `200000`) wired into
  `resolveConfig` (`frontend/src/lib/config.ts`) — makes T002 pass.
- [ ] T009 [FND] Expose `contextWindow` from resolved config on the chat context
  (`frontend/src/components/chat/chat-provider.tsx`), mirroring `usageEnabled` (depends T008).

**Checkpoint**: limit + per-turn `contextWindow` available to the UI; tests T002–T004 green.

---

## Phase 3: User Story 1 — Context-window meter (Priority: P1) 🎯 MVP

**Goal**: composer toolbar shows `used / limit · pct%` with warn/danger levels, near-realtime
after each reply, gated by `NEXT_PUBLIC_SHOW_USAGE`.

**Independent Test**: run/reload a conversation whose last assistant turn has usage → meter
shows occupancy; send another message → meter updates on completion without reload.

### Tests first

- [ ] T010 [P] [US1] Test `resolveContextUsage` in
  `frontend/src/lib/chat/__tests__/metrics.test.ts`: used = resolved total of last assistant
  with metrics; `limit = metrics.contextWindow ?? configLimit` (backend wins); pct clamped
  0–100; level normal/warn(≥70%)/danger(≥90%); no metrics ⇒ `level:"unknown"`.
- [ ] T011 [P] [US1] Test `ContextMeter` in
  `frontend/src/components/chat/__tests__/context-meter.test.tsx`: renders `12.4k / 200k · 6%`
  (compact tokens), applies the level class, returns `null` when `level === "unknown"`.

### Implementation

- [ ] T012 [US1] Add `ContextUsage` type, `resolveContextUsage(messages, configLimit)`, and
  `CONTEXT_WARN_PCT`/`CONTEXT_DANGER_PCT` to `frontend/src/lib/chat/metrics.ts` (makes T010
  pass).
- [ ] T013 [US1] Create `frontend/src/components/chat/context-meter.tsx` — presentational,
  `data-slot="context-meter"`, `formatTokens`, token-based level colors, forwards `className`
  via `cn(...)` (makes T011 pass; depends T012).
- [ ] T014 [US1] Wire it: in `chat-screen.tsx` derive
  `contextUsage = useMemo(resolveContextUsage(messages, contextWindow))` and pass
  `contextUsage` + `usageEnabled` to `ChatComposer`; in `chat-composer.tsx` render
  `<ContextMeter>` in the left toolbar cluster when `usageEnabled && contextUsage` (depends
  T013, T009).
- [ ] T015 [US1] Component test (extend `chat-composer.test.tsx`): meter shows when
  `usageEnabled` + usage present; hidden when `usageEnabled=false` or usage unknown.

**Checkpoint**: US1 fully functional & independently demoable (MVP).

---

## Phase 4: Foundational for compaction — thin request + ADR (precedes US2)

**Purpose**: send only the current turn so backend checkpoint compaction actually lowers
occupancy. Independently valuable/testable.

### Tests first

- [ ] T016 [P] [FND] Test in `frontend/src/hooks/chat/__tests__/` (the send-path test): the
  outbound request `messages` contains ONLY the current user turn (both the normal send and
  the queue-drain path); update any existing assertion that expected full history.

### Implementation

- [ ] T017 [FND] Thin request: change both history builders in
  `frontend/src/hooks/chat/use-chat.ts` (send ~L548-567 and queue-drain ~L329-341) to send
  `[{ role:"user", content, ...(attachments?{attachments}:{}) }]` only; keep `conversationId`
  + `agentId`. Local `ChatSession.messages` (display) untouched (makes T016 pass).
- [ ] T018 [FND] Update `ChatRequestSchema` + `ChatRequestMessageSchema` doc comments
  (`frontend/src/entities/transport.ts`) to the thin-request contract (current turn only;
  backend owns Checkpoint + History by `conversationId`).
- [ ] T019 [P] [FND] Write ADR `docs/design-docs/request-context-ownership.md`: Context,
  Decision (thin request + two-layer History/Checkpoint), Alternatives, Consequences.

**Checkpoint**: continuation still works (backend Checkpoint); payloads shrink; meter honest.

---

## Phase 5: User Story 2 — Manual /compact (Priority: P2)

**Goal**: `/compact` runs as a normal user turn (verbatim text; backend regex-parses it),
streams like any reply, summary lands as an assistant message; History + UI thread intact.

**Independent Test**: with a multi-turn chat, click the toolbar compact control → a `/compact`
user message + streamed assistant summary appear; meter reflects backend-reported usage.

### Tests first

- [ ] T020 [P] [US2] Test `frontend/src/lib/chat/__tests__/slash-commands.test.ts`:
  `matchCommands("/co")` returns `/compact`; `matchCommands("hi")` empty; `/compact` marked
  disabled when `messageCount === 0`.
- [ ] T021 [P] [US2] Test in `chat-composer.test.tsx`: clicking the compact control calls
  `onSend("/compact", [])`; control is disabled while `busy` and when the conversation is
  empty.

### Implementation

- [ ] T022 [P] [US2] Create `frontend/src/lib/chat/slash-commands.ts`: `SlashCommand` +
  `SlashCommandContext` types, `matchCommands(prefix)`, and `SLASH_COMMANDS` with `/compact`
  (`run = ctx.submit("/compact")`, disabled when `messageCount === 0`) — makes T020 pass.
- [ ] T023 [US2] Add the toolbar compact button to `chat-composer.tsx` (icon + tooltip),
  calling `onCompact ?? (() => onSend("/compact", []))`; disabled while `busy` or empty (makes
  T021 pass; depends T022).

**Checkpoint**: `/compact` usable via the toolbar even before the suggester exists.

---

## Phase 6: User Story 3 — Slash-command suggester (Priority: P3)

**Goal**: typing `/` at the start of the composer opens a popup listing commands; keyboard
nav; selecting `/compact` runs it.

**Independent Test**: type `/` → popup lists `/compact`; filter by prefix; Arrow+Enter/Tab
selects → submits the `/compact` turn; Esc / deleting `/` closes; ordinary text still sends.

### Tests first

- [ ] T024 [P] [US3] Test `slash-command-menu.test.tsx`: renders each command's name +
  description and marks the active item.
- [ ] T025 [US3] Test in `chat-composer.test.tsx`: `/` opens the menu; typing filters;
  ArrowUp/Down moves selection; Enter/Tab runs the highlighted command (submits `/compact`)
  without inserting a newline; Escape and deleting the leading `/` close it; a plain message
  (no leading `/`) sends normally. Interception respects `isComposing`.

### Implementation

- [ ] T026 [P] [US3] Create `frontend/src/components/chat/slash-command-menu.tsx` — `Popover`
  anchored above the textarea wrapping `Command`/`CommandList`/`CommandItem` (from
  `components/ui/command.tsx`); `data-slot="slash-command-menu"`; forwards `className` (makes
  T024 pass).
- [ ] T027 [US3] Integrate into `chat-composer.tsx`: `menuOpen` from `text.startsWith("/")`,
  `activeIndex` state, `matchCommands(text)`; extend `handleKeyDown` to intercept
  Arrow/Enter/Tab/Escape before the existing submit (guard `isComposing`); selecting a command
  runs its `run` and clears the input (makes T025 pass; depends T026, T022).

**Checkpoint**: all three stories independently functional.

---

## Phase 7: Polish & Docs (cross-cutting)

- [ ] T028 [P] [POL] Update `frontend/src/app/docs/sections/api-docs.tsx`: request example →
  current turn + `conversationId` (drop full-history array); add `context_window` to the
  `usage` example + `MessageMetrics` type; add the two-layer (History table vs Checkpoint)
  note and the `/compact` behavior line.
- [ ] T029 [P] [POL] Update `frontend/src/app/docs/sections/backend-integration.tsx`: thin
  request (backend owns context by `conversationId`); `usage.context_window` optional;
  `/compact` is a normal user turn the backend regex-recognizes to compact the Checkpoint.
- [ ] T030 [P] [POL] Reconcile `docs/design-docs/chat-transport.md` with the thin-request
  contract; link the new ADR.
- [ ] T031 [POL] Full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all green
  (static-export safe). Verify no SSE recording/mock regen is needed (request-shape change
  doesn't touch response recordings). Fix any fallout.

---

## Dependencies & Execution Order

- **Phase 1 → 2**: Setup then plumbing.
- **Phase 2 blocks US1 and US2** (schema + config + provider).
- **Phase 3 (US1)** depends only on Phase 2 → the MVP; ship/validate before continuing.
- **Phase 4 (thin request + ADR)** depends on Phase 2; precedes US2 for an honest occupancy
  drop, but does not block US1.
- **Phase 5 (US2)** depends on Phase 2 (+ Phase 4 for real effect).
- **Phase 6 (US3)** depends on US2's registry (T022) + the menu (T026).
- **Phase 7 (docs/gate)** after the stories it documents.

### Parallelizable

- Foundational tests T002/T003/T004 [P]; entity/lib edits T005/T006 [P].
- US1 tests T010/T011 [P]. US2 tests T020/T021 [P] + registry T022 [P]. US3 menu T026 [P].
- Docs T028/T029/T030 [P] (different files). ADR T019 [P].

### Within each story

Tests written and failing → implementation → integration. Commit after each task or logical
group (Conventional Commits; pre-commit gate must pass — no `--no-verify`).

---

## Notes

- No new dependencies; reuse `cmdk`/`popover`/`react-toastify`/`lucide` + existing formatters.
- `/compact` needs **no** transport change — it rides `onSend` as verbatim text.
- Load-bearing external assumption (spec): backend persists Checkpoint + History per
  `conversationId`. Verify with a 2-turn test before shipping T017 (thin request).
