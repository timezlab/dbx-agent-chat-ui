# Feature Specification: Context-Window Meter & Manual /compact

**Feature Branch**: `004-context-window-compact`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "hiển thị context window của đoạn chat cho user xem và có thể compact thủ công (dùng command /compact — cần trình gợi ý command); context window cần realtime (hoặc nearly realtime sau mỗi lần chat hoàn thành)"

## Overview

Give the user visibility into how much of the model's context window the current
conversation occupies, updated near-realtime after each completed reply, and a manual
way to shrink it: a `/compact` command (surfaced by a slash-command suggester in the
composer) that asks the backend to summarize the conversation so far and continue from
the summary.

**Settled decisions (from clarification):**

1. **/compact = a normal streaming turn.** Selecting `/compact` submits it as an ordinary
   **user message** through the existing `ChatTransport` and **streams exactly like any other
   turn**; when compaction finishes, the backend's summary arrives as a normal **assistant
   message** (the backend already models a `compact_conversation` capability). No special SSE
   frame and no bespoke client "replace history" operation — the compaction turn looks and
   behaves like a regular user→assistant exchange. The only backend dependency is that it
   recognizes the compaction message and summarizes server-side.
2. **Context limit = backend value if present, else env default.** The occupancy percentage
   needs a denominator (e.g. 200k). Use a backend-reported `contextWindow` on the usage
   frame when present; otherwise fall back to a configured `NEXT_PUBLIC_CONTEXT_WINDOW`
   default.
3. **Meter placement = composer toolbar, gated by the existing usage flag**
   (`NEXT_PUBLIC_SHOW_USAGE`). No new visibility flag.
4. **Thin request / backend-owned context (foundational).** The chat request stops sending the
   full history array; it sends **only the current user turn + `conversationId`**, and the
   backend owns the accumulated context ("checkpoint") keyed by `conversationId`. This is what
   makes checkpoint compaction actually reduce occupancy (otherwise the client re-inflates
   context every turn and the meter never drops). It is a **frontend-only** change here (two
   send-path builders + the request schema/docs) **provided** the backend already maintains and
   persists that checkpoint — see Assumptions.

## Two-layer context model (architecture context)

The backend keeps two distinct things, both keyed by `conversationId`:

1. **History** — the durable transcript stored in a Databricks table. It is the permanent
   record the history API serves back for display and reload. It is **never compacted or
   trimmed**; the UI shows every message from it. This is what `GET /conversation/{id}` returns.
2. **Checkpoint** — the working context the agent actually reads to generate a reply. It
   accumulates per conversation and is what `/compact` reduces. Its size is what the meter
   measures (via the backend-reported `input_tokens` of the latest turn).

Consequences for this feature:

- The client sends only the current user turn + `conversationId`; the backend appends it to the
  History table and feeds the Checkpoint to the agent (thin request, settled decision #4).
- Context occupancy = **Checkpoint size**, not History-table size. Compaction shrinks the
  Checkpoint, so the next turn's `input_tokens` (and the meter) drop — while the full History
  transcript, and the UI thread, stay intact.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how full the context window is (Priority: P1)

As a user in a long conversation, I want to see how much of the model's context window my
conversation currently occupies, so I know when I'm approaching the limit and my earliest
messages risk being dropped or degraded.

**Why this priority**: This is the core, always-on value and is independently shippable —
it is read-only, requires no backend contract change (occupancy is already derivable from
existing usage data), and delivers awareness even before compaction exists.

**Independent Test**: Load or run a conversation where the latest assistant reply carries
usage; the composer toolbar shows a meter like `12.4k / 200k · 6%`. Send another message;
after that reply completes, the meter updates to the new occupancy without a reload.

**Acceptance Scenarios**:

1. **Given** a conversation whose most recent assistant turn reports usage tokens, **When**
   the meter renders, **Then** it shows the occupancy (resolved total tokens of that turn),
   the limit, and the percentage used.
2. **Given** a reply is completing, **When** its usage frame arrives, **Then** the meter
   updates within the same render cycle (no reload) — near-realtime after each reply.
3. **Given** the backend reports a `contextWindow` on the usage frame, **When** the meter
   computes the percentage, **Then** it uses that value as the denominator; **Given** it does
   not, **Then** it falls back to the configured `NEXT_PUBLIC_CONTEXT_WINDOW` default.
4. **Given** occupancy crosses a warning threshold (e.g. ≥ 75%) or a danger threshold (e.g.
   ≥ 90%), **When** the meter renders, **Then** it visually signals the level (color/label).
5. **Given** a reloaded conversation, **When** the last assistant message carries persisted
   metrics, **Then** the meter reflects that occupancy on first paint.

---

### User Story 2 - Compact the conversation manually (Priority: P2)

As a user approaching the context limit, I want to run `/compact` to have the assistant
summarize the conversation so far and continue from that summary, so I can keep going
without hitting the limit or losing the thread. `/compact` behaves like a normal message: it
appears as my user turn, streams like any reply, and the summary lands as an assistant
message in the thread.

**Why this priority**: This is the actionable half of the feature. It rides the existing
send/stream path (no new SSE contract), but still depends on the backend recognizing the
compaction message, so it ships after the read-only meter.

**Independent Test**: With a multi-turn conversation, invoke `/compact` (via the toolbar
compact control, so this story is testable without the slash suggester). A `/compact` user
message appears and a turn streams normally; the assistant's summary renders as a normal
assistant message, and after the turn completes the context meter reflects the new occupancy.

**Acceptance Scenarios**:

1. **Given** a conversation with several turns, **When** the user triggers `/compact`, **Then**
   a user message is added and a turn is started through the normal transport send path — the
   same path as any chat message.
2. **Given** the compaction turn is in flight, **When** tokens arrive, **Then** they stream and
   render exactly like a normal assistant reply (including any `compact_conversation` tool
   activity the backend emits), with the live generating indicator.
3. **Given** the compaction turn completes, **When** its usage frame arrives, **Then** the
   summary is a settled assistant message and the context meter updates from that turn's usage
   (near-realtime, same mechanism as US1).
4. **Given** a reply is currently streaming, **When** the user triggers `/compact`, **Then**
   the action is disabled or queued (never interleaved with an in-flight turn), consistent with
   how the composer already handles sends during streaming.
5. **Given** the conversation is empty or has nothing to compact, **When** the user triggers
   `/compact`, **Then** the UI surfaces an informative no-op message and starts no turn.
6. **Given** the backend fails the compaction turn, **When** the error arrives, **Then** it is
   surfaced like any streaming error (error toast / error state on the turn), leaving prior
   messages intact.

---

### User Story 3 - Discover and run commands via a slash suggester (Priority: P3)

As a user, when I type `/` at the start of the composer, I want a suggestion popup listing
available commands (e.g. `/compact`) with a short description, so I can discover and run
client-side commands without leaving the input.

**Why this priority**: The suggester is the requested, discoverable entry point, but
`/compact` (US2) can also be triggered by a toolbar control, so the suggester is an
enhancement layered on top rather than a blocker.

**Independent Test**: Type `/` as the first character in the composer; a popup lists
`/compact`. Continue typing to filter; use arrow keys to move, Enter/Tab to select. Selecting
`/compact` triggers the compaction turn (US2).

**Acceptance Scenarios**:

1. **Given** the composer is empty, **When** the user types `/` as the first character,
   **Then** a suggestion popup opens anchored to the composer listing available commands.
2. **Given** the popup is open, **When** the user types more characters, **Then** the list
   filters to commands whose name matches the typed prefix.
3. **Given** the popup is open, **When** the user presses ArrowUp/ArrowDown then Enter (or
   Tab), **Then** the highlighted command's action runs and the composer text is cleared. (For
   `/compact`, its action is to start the compaction turn per US2.)
4. **Given** the popup is open, **When** the user presses Escape or deletes the leading `/`,
   **Then** the popup closes and normal typing/submit resumes.
5. **Given** the user submits text that does not start with a recognized `/command` (e.g.
   ordinary text that merely contains a slash), **When** they press Enter, **Then** it sends
   as a normal chat message.

*Note:* a command's action decides its own effect. `/compact` submits a turn (US2); the
registry (FR-015) also allows purely client-side commands (no turn) in future — the suggester
itself does not assume one or the other.

---

### Edge Cases

- **No usage available** (backend never sent tokens for the latest turn): the meter shows an
  unknown/placeholder state (e.g. "—") rather than a false 0%, and never renders a bar it
  can't compute.
- **Fresh conversation** (no assistant turn yet): the meter is hidden or shows `0 / limit`.
- **Limit unknown** (no backend `contextWindow` and no env value): percentage is hidden;
  raw occupancy may still show. (The env default should normally prevent this.)
- **Occupancy exceeds the limit** (over budget): the bar clamps at 100% and shows the danger
  level while still displaying the true token count.
- **Usage flag off** (`NEXT_PUBLIC_SHOW_USAGE` disabled): the meter does not render (and, by
  extension, neither does any usage-derived affordance gated with it).
- **`/compact` while offline / transport error**: history unchanged, error toast.
- **Slash suggester with `/` mid-text**: only triggers when the input starts with `/`; a
  slash later in the text is ordinary content.
- **Composition (IME) in progress**: navigation-key interception in the suggester must not
  fire mid-composition (respect `isComposing`), consistent with existing Enter handling.

## Requirements *(mandatory)*

### Functional Requirements

**Context-window meter (US1)**

- **FR-001**: The system MUST derive current context occupancy from the most recent assistant
  turn that carries usage — the resolved total tokens (`totalTokens`, else
  `inputTokens + outputTokens`) of that turn.
- **FR-002**: The system MUST determine the context limit as the backend-reported
  `contextWindow` when present on the usage frame, otherwise a configured
  `NEXT_PUBLIC_CONTEXT_WINDOW` default.
- **FR-003**: The system MUST display occupancy, limit, and percentage used in a compact,
  theme-aware meter in the composer toolbar, gated by `NEXT_PUBLIC_SHOW_USAGE`.
- **FR-004**: The meter MUST update near-realtime — within the render cycle triggered by each
  completed reply's usage frame — with no reload required.
- **FR-005**: The meter MUST visually distinguish at least a normal, a warning, and a danger
  level based on percentage thresholds.
- **FR-006**: Token counts in the meter MUST use the existing compact formatting
  (`556`, `1.2k`, `1.9M`).

**Manual compaction (US2)**

- **FR-007**: The system MUST provide a user-triggered compaction action reachable without the
  slash suggester (a toolbar control), so US2 is usable and testable on its own.
- **FR-008**: On `/compact`, the system MUST submit it as a normal user message through the
  existing transport send path and stream the turn exactly like any other reply. The backend
  recognizes the compaction message and summarizes server-side.
- **FR-009**: The system MUST NOT mutate, replace, or trim the local message history on
  compaction. Compaction operates on the **backend checkpoint**, not on user-visible history;
  all prior messages remain in the thread and the summary is appended as a normal assistant
  message.
- **FR-010**: The context meter MUST reflect the compacted context through the **usage the
  backend reports** (which counts the backend's checkpoint, not the raw messages the client
  sent). No client-side token re-estimation or history editing is used to make the meter drop.
- **FR-011**: The system MUST prevent compaction from interleaving with an in-flight turn
  (disabled or queued while streaming), consistent with the composer's existing send behavior.
- **FR-012**: The system MUST handle a `/compact` that has nothing to compact (informative
  no-op, no turn started) and a compaction turn that errors (surfaced like any streaming
  error), in both cases leaving the message history intact.

**Slash-command suggester (US3)**

- **FR-013**: When the composer input starts with `/`, the system MUST open a suggestion popup
  anchored to the composer listing available commands with names and short descriptions.
- **FR-014**: The suggester MUST filter commands by the typed prefix and support
  keyboard navigation (Arrow keys, Enter/Tab to select, Escape to dismiss) without
  submitting the command text as a chat message.
- **FR-015**: The command set MUST be defined in an extensible registry (initially one entry,
  `/compact`) so additional client-side commands can be added without rewiring the composer.
- **FR-016**: Selecting a command MUST run its client-side action and clear the composer;
  ordinary (non-command) input MUST continue to send as a normal chat message.

**Request model — thin request (foundational)**

- **FR-019**: The chat request MUST send only the **current user turn** plus `conversationId`
  (and `agentId` when set) — it MUST NOT send the full message-history array. Both send-path
  builders (the normal send and the queue-drain path) MUST be updated.
- **FR-020**: The `ChatRequest` schema and the API docs (api-docs + backend-integration) MUST
  be updated to describe the new contract: current turn + `conversationId`, with the backend
  owning the accumulated context (Checkpoint) and the durable transcript (History table).
- **FR-021**: The UI MUST continue to render the full conversation from its local/History
  state for display; the thin request changes only what is *sent*, never what is *shown*. No
  local message is dropped or merged.

**Cross-cutting**

- **FR-017**: All new components MUST forward `className` through a trailing `cn(...)` and use
  CSS-variable tokens (no hardcoded colors/radii), per the customization contract.
- **FR-018**: The feature MUST remain static-export safe and UI-only — no server routes, no
  secrets; only `NEXT_PUBLIC_*` config; backends reached only through the transport adapter.

### Key Entities *(include if feature involves data)*

- **ContextUsage (derived, not persisted)**: `{ used: number, limit: number | undefined,
  pct: number | undefined, level: "normal" | "warn" | "danger" | "unknown" }` computed from
  the latest assistant `Message.metrics` and the resolved limit.
- **MessageMetrics (extended)**: gains an optional `contextWindow` number (backend-reported
  limit), snake_case `context_window` on the wire, mapped in the usage extractor.
- **CapabilityConfig / env (extended)**: gains a `contextWindow` default sourced from
  `NEXT_PUBLIC_CONTEXT_WINDOW`, following the existing `usageEnabled` config pattern.
- **SlashCommand (registry entry)**: `{ name: string, description: string, run: (ctx) => void
  | Promise<void> }` — a command's `run` decides its effect; `/compact`'s `run` submits a turn.
- **Compaction turn (no new client history model)**: `/compact` is a normal user→assistant
  turn over the existing transport; there is **no** summary-marker entity, no client history
  replacement, and no bespoke SSE frame required by the UI. Server-side, compaction reduces the
  backend **checkpoint**; the UI observes the effect only through the `usage` tokens the
  backend reports on this and subsequent turns. **Open**: exactly how the backend recognizes a
  compaction message (literal `/compact` text vs a request flag) — finalize in `plan.md` with
  the backend team, informed by the existing `compact_conversation` tool schema.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After any reply that carries usage, the meter reflects the new occupancy with no
  user reload, within the same completion render.
- **SC-002**: The meter's percentage equals occupancy ÷ resolved limit (backend value when
  present, else env default), clamped to 0–100%.
- **SC-003**: A user can run `/compact` end-to-end (trigger → turn streams → summary lands as
  an assistant message) with a single action, both via the toolbar control and via the `/`
  suggester; the message history is left intact and the meter reflects backend-reported usage.
- **SC-004**: Typing `/` at the start of the composer surfaces the command list; selecting a
  command never sends the command text as a chat message (0 stray command messages).
- **SC-005**: All acceptance scenarios are covered by unit/component tests (Vitest + Testing
  Library) and pass; lint/typecheck/build are green (static-export safe).

## Assumptions

- **Occupancy = Checkpoint size**: with the thin request, the latest assistant turn's
  backend-reported tokens reflect the agent's Checkpoint (not the History table), so the meter
  is an honest measure of what the model actually processes. Mid-stream (partial) estimation is
  **out of scope for v1** — the meter updates on reply completion (the user's stated "nearly
  realtime sau mỗi lần chat hoàn thành").
- **Backend owns Checkpoint + History (load-bearing)**: the backend maintains, per
  `conversationId`, both a durable History table and an accumulating Checkpoint the agent
  reads, and both **persist** so a conversation continues after reload / in a new session
  without the client re-sending history. This is the single fact that makes the thin request
  safe; it is the backend's responsibility and must hold before FR-019 ships. Quick
  verification: send two turns, confirm the second reply "remembers" the first when only the
  current turn is sent.
- **Default limit**: `NEXT_PUBLIC_CONTEXT_WINDOW` defaults to a sensible value (proposed
  200,000) that deployers override per model. The precise default is a plan detail.
- **Backend compaction exists / will be implemented**: US2 depends on the backend recognizing
  the `/compact` turn and compacting its checkpoint. Until the backend ships it, `/compact`
  still streams as a normal turn (the backend just replies normally), and US1 (meter) and US3
  (suggester UX) ship independently.
- **Occupancy drop is backend-driven**: because the UI never trims local history, the meter
  drops only when the backend reports smaller `usage` for the compacted checkpoint. The exact
  turn at which the drop appears (the compaction turn itself vs the next turn) depends on
  backend behavior and is not something the UI controls.
- **Reuse existing primitives**: the suggester uses the already-present `cmdk`
  `Command*` inside a `Popover`; feedback uses the existing `react-toastify` host; token
  formatting reuses `formatTokens`/`resolveTotalTokens`. No new heavy dependencies.
- **Gating**: the meter reuses `NEXT_PUBLIC_SHOW_USAGE`; no separate context-visibility flag.

## Non-Goals (v1)

- Mid-stream / per-keystroke token estimation of the *unsent* draft.
- Automatic (threshold-triggered) compaction — v1 is manual only.
- A general command palette beyond the composer slash menu (`/compact` is the only command).
- Client-side summarization, trimming, or any editing of local message history — compaction is
  a backend checkpoint operation; the UI never mutates the thread.
- Editing or configuring the context limit from within the UI at runtime.

## Open Questions (resolve in plan.md)

- **OQ-1**: How the backend recognizes a compaction turn — is the user message the literal
  `/compact` text sent as-is, or does the UI map it to a canonical instruction / request flag
  while still displaying a friendly user bubble? (Reuse of the existing `compact_conversation`
  tool activity for rendering is desirable.)
- **OQ-2**: The user-message presentation for `/compact` — show the raw `/compact` text, or a
  friendlier labeled chip — and whether the assistant summary needs any distinct styling vs a
  normal reply.
- **OQ-3**: Exact warning/danger percentage thresholds and the default `NEXT_PUBLIC_CONTEXT_WINDOW`.
