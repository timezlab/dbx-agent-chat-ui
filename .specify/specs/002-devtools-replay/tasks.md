---
description: "Task list for Dev-tools SSE Replay implementation"
---

# Tasks: Dev-tools SSE Replay

**Input**: Design documents from `.specify/specs/002-devtools-replay/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/replay.md](./contracts/replay.md), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED — Principle VI (Test-First) is NON-NEGOTIABLE. Every non-trivial unit gets a failing test first (see the `tdd` rule). Node build scripts are tested with small fixture strings only — never by reading the base64 capture.

**Organization**: Tasks are grouped by user story. All paths are under `frontend/` (the dev route's cwd and the app root).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 (setup / foundational / polish carry no story label)

---

## Phase 1: Setup

**Purpose**: Declare the gating flag the rest of the feature keys off.

- [x] T001 Add `NEXT_PUBLIC_DEV_TOOLS` (`z.string().optional()`) to the client schema in `frontend/src/env.ts` (non-secret selector, default off; D-R8 / FR-026).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared parse/delay module and the config-gating chain that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Write failing test for `parseDevToolsEnabled` in `frontend/src/lib/__tests__/config.test.ts` (`"1"/"true"/"yes"` ⇒ true; unset/`"false"`/`""` ⇒ false).
- [x] T003 Implement `parseDevToolsEnabled` and expose `config.devToolsEnabled` in `frontend/src/lib/config.ts` (mirror `parseUploadEnabled`, reading `env.NEXT_PUBLIC_DEV_TOOLS`).
- [x] T004 Add `devToolsEnabled: boolean` to `CapabilityConfig` and its zod schema in `frontend/src/entities/config.ts` (default `false`).
- [x] T005 Plumb `config.devToolsEnabled` through the context value in `frontend/src/components/chat/chat-provider.tsx`.
- [x] T006 [P] Write failing parity test for `parseFrames` / `delayFor` (incl. optional timing override) in `frontend/src/lib/stream/__tests__/recording.test.ts`.
- [x] T007 Extract `parseFrames`, `delayFor`, `TEXT_DELAY_MS`, `TOOL_DELAY_MS` into a pure `frontend/src/lib/stream/recording.ts` (no `node:*`; `delayFor` gains an optional `{textDelayMs, toolDelayMs}` override defaulting to the constants; D-R1 / FR-017 / FR-018).
- [x] T008 Refactor `frontend/src/app/api/chat/route.dev.ts` to import the extracted functions from `recording.ts` (delete the now-duplicated logic; keep its `node:fs` I/O local).

**Checkpoint**: Config flag resolves and gates context; shared parse/delay module is the single source of truth for both the dev route and (next) the replay engine.

---

## Phase 3: User Story 1 - Enable Replay mode and play the default recording (Priority: P1) 🎯 MVP

**Goal**: From the Dev tools entry, toggle Replay mode → the composer is replaced by a Replay control with the Default recording selected → Play streams a realistic multi-tool/multi-turn assistant turn to a single completed terminal; toggling off restores the composer and cancels any in-progress replay.

**Independent Test**: Serve the static/embed build (no reachable endpoint), enable Replay mode, press Play with the default source, confirm the recorded conversation renders through the normal chat flow to completion, then disable Replay mode and confirm the composer returns.

### Tests for User Story 1 (write first — must FAIL before implementation) ⚠️

- [x] T009 [P] [US1] Failing tests for `streamReplay` core in `frontend/src/lib/stream/__tests__/replay.test.ts`: one `onClose("done")` per run; empty / all-malformed recording ⇒ `onClose("error")`; `abort()` ⇒ single `onClose("abort")` (idempotent); an individual malformed frame is skipped, not fatal (uses injected `sleep`).
- [x] T010 [P] [US1] Failing tests for `useChat` replay in `frontend/src/hooks/chat/__tests__/use-chat.replay.test.ts`: `replayPlay` creates a labelled user turn + assistant turn and drives the reducer; `history.save` is **never** called while `replayMode` is on; `toggleReplayMode` resets to a fresh conversation.
- [x] T011 [P] [US1] Failing tests for `ReplayControl` in `frontend/src/components/chat/__tests__/replay-control.test.tsx`: renders inside the composer wrapper with matching footprint/structural classes; default source present; Play enabled with the default source; forwards `className` via trailing `cn(...)`.
- [x] T012 [P] [US1] Failing test for the strip script in `frontend/scripts/__tests__/strip-recording-images.test.ts`: a fixture frame containing `![...](data:image/...;base64,...)` / `[chart]` yields output with **zero** `data:image/...;base64,` payloads (no base64 emitted).
- [x] T013 [P] [US1] Failing test for the gen script in `frontend/scripts/__tests__/gen-replay-recording.test.ts`: a fixture recording round-trips into the generated module string (`DEFAULT_REPLAY_RECORDING === <original contents>`).

### Implementation for User Story 1

- [x] T014 [US1] Implement `frontend/scripts/strip-recording-images.mjs` (JSON-aware per-frame strip of base64 image markdown + bare `[chart]`, reusing the sticky-scan approach from `format-sse-recording.mjs`; never prints base64), then run it to regenerate `frontend/sse-recordings/default.txt` into a realistic, base64-free multi-tool/multi-turn stream (D-R7 / FR-021 / FR-022 / SC-004).
- [x] T015 [US1] Implement `frontend/scripts/gen-replay-recording.mjs` → generate the **committed** `frontend/src/lib/stream/recordings/default-recording.generated.ts` exporting `DEFAULT_REPLAY_RECORDING: string` (D-R6 / FR-006 / FR-023).
- [x] T016 [US1] Prepend `gen-replay-recording.mjs` to `build:embed` and `build:manual` scripts in `frontend/package.json` so the bundled copy always matches the committed recording (FR-023 / SC-005).
- [x] T017 [US1] Implement `streamReplay` + `ReplayHandle` core in `frontend/src/lib/stream/replay.ts`: async frame loop over `parseFrames`, `createResponsesParser().map(json)` → `handlers.onEvent`, exactly one `onClose` terminal (`done`/`error`/`abort`), injectable `sleep`; `abort()` idempotent (pause/resume/setSpeed land in US2/US4). (D-R2 / FR-012 / FR-014 / FR-025).
- [x] T018 [US1] Extend `frontend/src/hooks/chat/use-chat.ts`: `replayMode` + `toggleReplayMode` (reset to a fresh, non-persisted conversation), `replaySession` (status), `replayPlay` (labelled user + assistant turn, wired to the **same** `onEvent` reducer/error-toast and `onClose` `handleClose` as `beginGeneration`), store the `ReplayHandle`, abort it on `cancel()` / mode-off, and **suppress** `history.save` while `replayMode` is active (D-R4 / D-R5 / FR-011 / FR-013 / FR-020).
- [x] T019 [US1] Create `frontend/src/components/chat/replay-control.tsx`: default source + Play, inside the identical composer wrapper, matching footprint/min-height, docking the same `TodoCard` strip; forwards `className` (D-R9 / FR-002 / FR-002a / SC-007).
- [x] T020 [US1] Swap `ChatComposer` ↔ `ReplayControl` on `replayMode` inside the same `<div className="mx-auto w-full max-w-3xl px-4 pb-4">` wrapper in `frontend/src/components/chat/chat-screen.tsx` (FR-002 / FR-003).
- [x] T021 [US1] Convert `frontend/src/components/shell/nav-devtools.tsx` from the test-toast dropdown into a Replay-mode toggle wired to `toggleReplayMode` (FR-001).
- [x] T022 [US1] Render `NavDevTools` only when `config.devToolsEnabled` in `frontend/src/components/shell/app-sidebar.tsx` (FR-026).
- [x] T023 [US1] Expose the replay surface (`replayMode`, `toggleReplayMode`, `replaySession`, replay actions) through `frontend/src/components/chat/chat-provider.tsx` (extends T005; same file, sequential).

**Checkpoint**: US1 is independently demonstrable — enable Replay mode, Play the default recording to completion, toggle off. MVP complete.

---

## Phase 4: User Story 2 - Pause and resume during playback (Priority: P1)

**Goal**: Pause freezes the stream at the current frame (partial output retained, no terminal); Play resumes from the paused position without re-rendering shown frames.

**Independent Test**: Start a replay, Pause partway (confirm zero further frames render and no completion), then Play and confirm it continues to a single terminal from the paused position.

### Tests for User Story 2 (write first — must FAIL) ⚠️

- [x] T024 [P] [US2] Failing tests in `frontend/src/lib/stream/__tests__/replay.test.ts`: `pause()` suspends before the next frame's `onEvent`, renders **zero** frames while paused, emits **no** terminal; `resume()` continues from the same position and still settles to exactly one terminal (FR-010 / SC-003).
- [x] T025 [P] [US2] Failing tests in `frontend/src/hooks/chat/__tests__/use-chat.replay.test.ts`: `replayPause` → status `paused`; `replayPlay` from paused resumes; disabling Replay mode while paused cancels to one `stopped` terminal.

### Implementation for User Story 2

- [x] T026 [US2] Implement `pause()` / `resume()` (and `status`) in `frontend/src/lib/stream/replay.ts` (await-a-resume-promise guard before each frame; pause is not a terminal).
- [x] T027 [US2] Wire `replayPause` and Play-as-resume + `replaySession.status` transitions in `frontend/src/hooks/chat/use-chat.ts`.
- [x] T028 [US2] Add the Pause/Play toggle reflecting `replaySession.status` in `frontend/src/components/chat/replay-control.tsx`.

**Checkpoint**: US1 + US2 — full play/pause/resume/cancel transport surface at default timing.

---

## Phase 5: User Story 3 - Choose the recording source (Priority: P2)

**Goal**: Source selector offers Default or Upload `.txt`; uploads are read client-side via `FileReader`, validated (type/size), and never persisted.

**Independent Test**: Choose a local `.txt` recording, Play, and confirm its contents render identically to the default path; reload and confirm nothing was restored.

### Tests for User Story 3 (write first — must FAIL) ⚠️

- [x] T029 [P] [US3] Failing tests in `frontend/src/components/chat/__tests__/replay-control.test.tsx`: non-`.txt` / oversized / empty file rejected with an inline error and Play blocked; valid upload shows name + size and enables Play (FR-008 / FR-009 / edge cases).

### Implementation for User Story 3

- [x] T030 [US3] Implement the source selector + `FileReader` upload + `.txt`/size/empty validation with inline error in `frontend/src/components/chat/replay-control.tsx` (FR-005 / FR-007 / FR-008).
- [x] T031 [US3] Add `replaySetSource({kind:"default"} | {kind:"upload"; file})` to `frontend/src/hooks/chat/use-chat.ts`, feeding the chosen text into `streamReplay` (non-persisted; FR-020 / SC-006 already enforced by the US1 save-suppress + reset).

**Checkpoint**: US1–US3 — default and uploaded recordings both replay; nothing persists.

---

## Phase 6: User Story 4 - Adjust delay and speed (Priority: P3)

**Goal**: Editable text/tool delays (defaults 20 / 400 ms) with reset, and a ×0.5/×1/×2/×4 speed multiplier (`effectiveDelay = baseDelay / speed`); values clamped so playback can never hang; a speed change applies to subsequent frames only.

**Independent Test**: Slow the tool delay / set ×0.5 and observe tool rows appear later; ×4 is faster; Reset restores defaults; changing speed mid-play does not corrupt position.

### Tests for User Story 4 (write first — must FAIL) ⚠️

- [x] T032 [P] [US4] Failing tests in `frontend/src/lib/stream/__tests__/replay.test.ts`: per-frame wait = `delayFor(frame, timing) / max(speed, minSpeed)` (assert via injected `sleep`); `setSpeed` affects only subsequent frames; invalid/out-of-range timing is clamped (no hang / busy-loop) (FR-015 / FR-016).

### Implementation for User Story 4

- [x] T033 [US4] Implement timing override + speed multiplier + clamping + `setSpeed` in `frontend/src/lib/stream/replay.ts` (D-R3 / FR-015 / FR-016).
- [x] T034 [US4] Add `replaySetTiming` / `replayResetTiming` / `replaySetSpeed` to `frontend/src/hooks/chat/use-chat.ts` (validate/clamp; forward to the `ReplayHandle`).
- [x] T035 [US4] Add text/tool delay inputs + Reset and the ×0.5/×1/×2/×4 speed select to `frontend/src/components/chat/replay-control.tsx` (FR-004 / FR-015).

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T036 [P] Write the ADR `docs/design-docs/dev-replay.md` — replay as a non-network client stream source and the Principle IV nuance (Context / Decision / Alternatives / Consequences).
- [x] T037 [P] Update `docs/design-docs/dev-mock-endpoint.md` (and the design-docs index in `AGENTS.md`) to reference the shared `lib/stream/recording.ts` module (Principle VII / docs-as-code freshness).
- [x] T038 [P] Document `NEXT_PUBLIC_DEV_TOOLS` in the frontend env template / README env section (non-secret, default off).
- [x] T039 Run `quickstart.md` validation: `pnpm test` + `pnpm lint`; `pnpm build:embed` and `pnpm build:manual` succeed; flag-off build renders no Dev tools / Replay affordance; committed `default.txt` + generated module are base64-free and well under 9.5 MB (SC-004/005), embed plays default with zero network requests.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001)** → no dependencies.
- **Foundational (T002–T008)** → depends on T001; **blocks all user stories**. Config chain T003→T004→T005 is sequential; recording chain T006→T007→T008 is sequential; the two chains are mutually parallel.
- **US1 (T009–T023)** → depends on Foundational. MVP.
- **US2 (T024–T028)** → depends on US1 (extends `replay.ts`, `use-chat.ts`, `replay-control.tsx`).
- **US3 (T029–T031)** → depends on US1 (extends `replay-control.tsx`, `use-chat.ts`). Independent of US2.
- **US4 (T032–T035)** → depends on US1. Independent of US2/US3.
- **Polish (T036–T039)** → T036–T038 after US1; T039 after all desired stories.

### Within each story

- Test tasks (`[P]`, different files) come first and must fail before implementation.
- `replay.ts` engine before `use-chat.ts` wiring before `replay-control.tsx` UI.
- Same-file tasks (e.g. multiple `replay-control.tsx` edits across stories) are sequential by phase order.

### Parallel opportunities

- Foundational: T002 ∥ T006 (then their respective chains).
- US1 tests: T009 ∥ T010 ∥ T011 ∥ T012 ∥ T013 (all different files).
- US1 impl: the two build scripts T014/T015 are sequential (T015 consumes T014's `default.txt`); UI wiring T020–T022 touch different files and can parallelize after T017–T019 land.
- Polish: T036 ∥ T037 ∥ T038.

---

## Parallel Example: User Story 1 tests

```bash
# Launch the failing US1 test tasks together (different files):
Task: "streamReplay core tests in frontend/src/lib/stream/__tests__/replay.test.ts"
Task: "useChat replay tests in frontend/src/hooks/chat/__tests__/use-chat.replay.test.ts"
Task: "ReplayControl tests in frontend/src/components/chat/__tests__/replay-control.test.tsx"
Task: "strip-script test in frontend/scripts/__tests__/strip-recording-images.test.ts"
Task: "gen-script test in frontend/scripts/__tests__/gen-replay-recording.test.ts"
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 Setup (T001) → Phase 2 Foundational (T002–T008).
2. Phase 3 US1 (T009–T023).
3. **STOP and validate** via the US1 Independent Test + quickstart §US1 (incl. the static/embed zero-network check).
4. Demoable in every deployment target.

### Incremental delivery

US1 (MVP) → add US2 (pause/resume) → add US3 (upload source) → add US4 (delay/speed) → Polish. Each story is independently testable and adds value without breaking the previous ones.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- TDD is enforced (Principle VI): verify each test fails for the expected reason before writing production code.
- Never persist replay turns; never emit base64 to stdout from scripts.
- Commit after each task or logical group; one logical change per commit.

---

## Extension — 2026-07-14: US5 (real question · download · right toolbar)

Enforce TDD (Principle VI): each test must fail for the expected reason before production code.

- [ ] T040 [US5] `recording.ts`: add `extractUserRequest(recording)` + `serializeRecording(question, frames)` (pure). Tests in `frontend/src/lib/chat/__tests__/recording.test.ts` (FR-027/FR-031).
- [ ] T041 [US5] `use-replay.ts`: user-turn label = `extractUserRequest(recording) ?? <filename fallback>`; add `replayTypingText` typing sequence (paced by textDelayMs) before committing the user turn; pause/abort suspend/cancel typing (FR-028/FR-029). Tests in `use-chat.replay.test.ts`.
- [ ] T042 [US5] `chat-composer.tsx`: add `overrideText?: string | null` (read-only display of the typed question) (FR-029/FR-030).
- [x] T043 [US5] `scripts/gen-replay-recording.mjs`: inject the `replay.user_request` sentinel into the generated recording (raw `default.txt` stays a pure stream); regenerate `default-recording.generated.ts` (FR-027/FR-027a).
- [ ] T050 [US5] `replay-control.tsx` + `use-replay.ts`: collapsed icon rail by default, expand to settings (FR-033); `replayReset` restart action clears the transcript in place (FR-034).
- [ ] T044 [US5] `chat-screen.tsx`: keep composer mounted in replay mode (read-only); render `ReplayControl` as a sticky right-edge toolbar (FR-030).
- [ ] T045 [US5] `replay-control.tsx`: restyle into a compact vertical right-side panel; drop the docked TodoCard (FR-030).
- [ ] T046 [US5] `transport.ts`: optional `onRawFrame?(data)` on `ChatStreamHandlers`, invoked per frame in `streamSSE.onmessage` (FR-032). Test in `transport.test.ts`.
- [ ] T047 [US5] `use-chat.ts`: `recordingsRef` capture per assistant turn; expose `downloadRecording(id)` + `recordedIds`; clear on new/select conversation (FR-031/FR-032). Test in `use-chat` tests.
- [ ] T048 [US5] Download button in `assistant-message.tsx`, threaded via `chat-provider.tsx` + `messages/message-list.tsx`; shown only for turns with a captured recording (FR-031).
- [ ] T049 [US5] Run quality gates: `pnpm test` + `pnpm lint` + typecheck.
