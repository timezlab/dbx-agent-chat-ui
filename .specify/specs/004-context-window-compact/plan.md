# Implementation Plan: Context-Window Meter & Manual /compact

**Branch**: `004-context-window-compact` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specify/specs/004-context-window-compact/spec.md`

## Summary

Add (1) a **context-window meter** in the composer toolbar showing how much of the model's
context the conversation's **Checkpoint** occupies, updated near-realtime after each reply;
(2) a manual **`/compact`** that rides the normal send path as a user turn (backend compacts
the Checkpoint, History table untouched); (3) a **slash-command suggester** popup in the
composer. Foundation: switch the chat request to **thin request** — send only the current
turn + `conversationId`, letting the backend own the Checkpoint (the change that makes the
meter honest and compaction effective).

Technical approach: occupancy is a **pure derivation** from the last assistant message's
`metrics` (backend-reported tokens) ÷ a resolved limit (backend `contextWindow` on the usage
frame, else `NEXT_PUBLIC_CONTEXT_WINDOW`). No new streaming machinery — reuse the existing
`usage` event/reducer path, `cmdk` + `Popover`, `react-toastify`, and the metric formatters.

## Resolved Decisions (were spec Open Questions)

- **OQ-1 — how the backend recognizes `/compact`**: the user message is the **literal
  `/compact` text**, sent **verbatim** through the existing send path — the UI never strips or
  transforms it. **No new request field.** The **backend regex-parses the message text** to
  decide whether it is a command (`/compact`) and runs its checkpoint compaction; any text that
  doesn't match is treated as a normal message. (If the backend later prefers an explicit
  signal, a `command?: "compact"` field can be added to `ChatRequest` without UI rework — but
  v1 ships literal-text to keep it "just a user message".)
- **OQ-2 — presentation**: the `/compact` user bubble shows the raw `/compact` text; the
  assistant summary renders as a normal reply (including any `compact_conversation` tool
  activity the backend emits, which the UI already renders). No special styling in v1.
- **OQ-3 — thresholds + default**: `warn ≥ 70%`, `danger ≥ 90%`; default
  `NEXT_PUBLIC_CONTEXT_WINDOW = 200000`. All three are single constants, trivially tunable.

## Technical Context

**Language/Version**: TypeScript, React 19, Next.js 16 (App Router, `output: "export"`).

**Primary Dependencies**: existing only — `zod`, `cmdk` (`command.tsx`), `radix-ui`
(`popover.tsx`), `react-toastify`, `lucide-react`, TanStack Query. **No new dependency.**

**Storage**: none client-side (backend owns History + Checkpoint; metrics round-trip through
`Message.metrics` per the existing contract).

**Testing**: `vitest` + Testing Library (TDD per constitution VI — failing test first for each
non-trivial unit).

**Target Platform**: static-export bundle (notebook proxy / Databricks App / manual copy).

**Project Type**: single frontend app under `frontend/`.

**Performance Goals**: meter derivation is O(messages) memoized on `conversation.messages`;
no per-token work. Suggester filtering is over a tiny static registry.

**Constraints**: static-export safe, UI-only, no secrets (`NEXT_PUBLIC_*` only), every new
component forwards `className` via trailing `cn(...)` and uses CSS-variable tokens.

**Scale/Scope**: ~4 new files, ~8 edited files, ~1 ADR, ~6 test files. No backend code here.

## Constitution Check

*GATE: must pass before and after design.*

| Principle | Status | Note |
|---|---|---|
| I. UI-Only, No Backend | ✅ | Compaction is backend-owned; UI only sends `/compact` text + renders. No server code added. |
| II. No Secrets in Bundle | ✅ | `NEXT_PUBLIC_CONTEXT_WINDOW` is a non-secret integer, follows the `usageEnabled` pattern. |
| III. Static-Export Safe | ✅ | No route handlers / server actions / request-time headers; all client-side. |
| IV. Backends Only Through Adapters | ✅ | `/compact` and thin request go through the existing `ChatTransport.send`; no component fetches directly. |
| V. Customization Is a Contract | ✅ | New components forward `className`, use tokens; meter gated by existing `NEXT_PUBLIC_SHOW_USAGE`; limit is config, not hardcoded. |
| VI. Test-First | ✅ | Each unit (formatters, derivation, config parse, extractUsage, suggester, thin request) gets a failing test first. |
| VII. Spec-Driven & Docs-as-Code | ✅ | spec→plan→tasks under `004-`; the thin-request/two-layer change gets an ADR. Docs (api-docs, backend-integration, chat-transport.md) reconciled. |

**Complexity Tracking**: no principle violations → no justification needed.

## Design

### Data & config changes

1. **`src/entities/message.ts`** — `MessageMetricsSchema`: add
   `contextWindow: z.number().optional()` (backend-reported context limit for this turn).
2. **`src/entities/transport.ts`** — `usage` variant of `ChatStreamEventSchema`: add
   `contextWindow: z.number().optional()`. Also update `ChatRequestSchema.messages` doc comment
   from "full history" → "current turn only; backend owns accumulated context by
   `conversationId`" (behavior change lives in use-chat; schema stays `z.array` to allow the
   single-element send and remain backward-tolerant).
3. **`src/lib/chat/responses.ts`** — `extractUsage`: map `usage.context_window` (and
   `max_tokens` as an alias) → `contextWindow`.
4. **`src/lib/chat/reducer.ts`** — `mergeMetrics`: fold `contextWindow` (enumerated like the
   others, keep-present-only).
5. **Config trio** (mirror `usageEnabled` exactly):
   - `src/env.ts` — add `NEXT_PUBLIC_CONTEXT_WINDOW: z.string().optional()` (+ `runtimeEnv`).
   - `src/entities/config.ts` — add `contextWindow: z.number().optional()`.
   - `src/lib/config.ts` — add `parseContextWindow(raw)` (default `200000`; non-numeric/≤0 ⇒
     default) and wire into `resolveConfig`.

### Occupancy derivation (pure, US1)

6. **`src/lib/chat/metrics.ts`** — add:
   - `type ContextUsage = { used: number; limit: number | undefined; pct: number | undefined;
     level: "normal" | "warn" | "danger" | "unknown" }`.
   - `resolveContextUsage(messages: Message[], configLimit: number | undefined): ContextUsage`
     — find the last assistant message carrying metrics; `used = resolveTotalTokens(metrics)`;
     `limit = metrics.contextWindow ?? configLimit`; `pct = limit ? clamp(used/limit) : undefined`;
     level from thresholds (70/90). No metrics/used ⇒ `level:"unknown"`.
   - threshold constants `CONTEXT_WARN_PCT = 0.7`, `CONTEXT_DANGER_PCT = 0.9`.

### Context meter component (US1)

7. **`src/components/chat/context-meter.tsx`** (new) — presentational; props
   `{ usage: ContextUsage } & ComponentProps<"div">`. Renders `12.4k / 200k · 6%` with a thin
   bar; color by `level` via tokens (`text-muted-foreground` / warn / `text-destructive`).
   Uses `formatTokens`. Returns `null` when `level === "unknown"` (no false 0%). Forwards
   `className` via `cn(...)`, sets `data-slot="context-meter"`.

### Slash-command suggester (US3)

8. **`src/lib/chat/slash-commands.ts`** (new) — registry + type:
   `type SlashCommand = { name: string; description: string; run: (ctx: SlashCommandContext)
   => void }`. `SlashCommandContext` exposes what a command needs (e.g. `submit(text)`,
   `messageCount`, `busy`). Export `SLASH_COMMANDS` with one entry: `/compact` whose `run`
   calls `submit("/compact")`, disabled when `messageCount === 0`. Pure list + a
   `matchCommands(prefix)` filter helper (unit-tested).
9. **`src/components/chat/slash-command-menu.tsx`** (new) — `Popover` (anchored above the
   textarea, non-modal) wrapping `Command`/`CommandList`/`CommandItem` from `command.tsx`.
   Props: `{ open, query, commands, activeIndex, onSelect, onHover }`. Keyboard-agnostic
   (navigation handled by the composer so Enter/Arrow stay on the textarea); shows name +
   description. `data-slot="slash-command-menu"`.

### Composer integration (US2 + US3)

10. **`src/components/chat/chat-composer.tsx`**:
    - New props: `contextUsage?: ContextUsage`, `usageEnabled?: boolean`,
      `onCompact?: () => void` (optional explicit hook; default path just uses `onSend`).
    - Slash state: `menuOpen` derived from `text.startsWith("/")` (and not blank after `/`);
      `activeIndex`. `matchCommands(text)` drives the list.
    - `handleKeyDown`: when `menuOpen`, intercept ArrowUp/ArrowDown (move `activeIndex`),
      Enter/Tab (run highlighted command, `preventDefault`), Escape (close) — all **before**
      the existing Enter-submit, and still gated on `!isComposing`.
    - Render `<SlashCommandMenu>` over the textarea and, in the **left** toolbar cluster
      (next to `UploadButton`), render `<ContextMeter>` when `usageEnabled && contextUsage`.
    - A small **compact button** (toolbar) as the non-suggester trigger (FR-007): calls
      `onCompact ?? (() => onSend("/compact", []))`; disabled while `busy` or when empty.
11. **`src/components/chat/chat-screen.tsx`**:
    - Pull `contextWindow` + `usageEnabled` from `useChatContext()`.
    - `const contextUsage = React.useMemo(() => resolveContextUsage(messages, contextWindow),
      [messages, contextWindow])`.
    - Pass `contextUsage`, `usageEnabled` to `<ChatComposer>`.
12. **`src/components/chat/chat-provider.tsx`** — expose `contextWindow` (from resolved
    config) on the context, mirroring `usageEnabled`.

### Thin request (foundational, FR-019..021)

13. **`src/hooks/chat/use-chat.ts`** — both history builders:
    - send path (~L548-567) and queue-drain (~L329-341): replace
      `[...snapshot.messages.map(...), {current turn}]` with **just the current turn**
      `[{ role: "user", content, ...(attachments ? {attachments} : {}) }]`.
    - `conversationId` + `agentId` already ride `beginGeneration`; no other change.
    - Local `ChatSession.messages` (display) is untouched — only the outbound `history` array
      shrinks (FR-021).

### Docs & ADR (Docs-as-Code)

14. **`docs/design-docs/request-context-ownership.md`** (new ADR) — Context (full-history vs
    checkpoint incoherence), Decision (thin request + backend-owned Checkpoint, two-layer
    History/Checkpoint model), Alternatives (keep full history / client-side trim), Consequences
    (Better: honest meter, effective compaction, smaller payloads; Worse: edit/retry would need
    backend rewind later; Must now be true: backend persists Checkpoint + History per
    `conversationId`).
15. **`src/app/docs/sections/api-docs.tsx`** — request example → current turn + `conversationId`
    (drop full-history array + its comment); add `context_window` to the `usage` example +
    `MessageMetrics` type; add a short two-layer (History table vs Checkpoint) note and the
    `/compact` behavior line.
16. **`src/app/docs/sections/backend-integration.tsx`** — document: request carries only the
    current turn (backend owns context by `conversationId`); `usage.context_window` optional;
    `/compact` is a normal user turn the backend recognizes to compact the Checkpoint.
17. **`docs/design-docs/chat-transport.md`** — reconcile the "full history" description with
    the thin-request contract; link the ADR.

## Test Surface (TDD — failing test first)

| Unit | Test file | Assert |
|---|---|---|
| `parseContextWindow` | `lib/__tests__/config.test.ts` (or existing) | default 200000; numeric parse; invalid ⇒ default |
| `extractUsage` context_window | `lib/chat/__tests__/responses.test.ts` | `context_window`/`max_tokens` → `contextWindow` |
| `mergeMetrics` contextWindow | reducer test | folds contextWindow keep-present-only |
| `resolveContextUsage` | `lib/chat/__tests__/metrics.test.ts` | used/limit/pct/level; backend limit > config; unknown when no metrics; clamp >100% |
| `ContextMeter` | `components/chat/__tests__/context-meter.test.tsx` | renders `x / y · z%`, level class, null on unknown |
| `matchCommands` + registry | `lib/chat/__tests__/slash-commands.test.ts` | prefix filter; `/compact` disabled when empty |
| `SlashCommandMenu` + composer keys | `components/chat/__tests__/chat-composer.test.tsx` | `/` opens menu, Arrow/Enter/Tab/Esc, select submits `/compact`, ordinary text still sends |
| Thin request body | `hooks/chat/__tests__/use-chat.*.test.ts` | outbound `messages` = only current turn (+ queue-drain path) |

Also update any existing use-chat test that asserts full-history in the request body.

## Rollout / Independence

- **US1 (meter)** ships first and standalone — needs items 1–7, 11–12 (+ optionally the thin
  request for an honest number, but the meter renders correctly either way).
- **Foundational thin request** (13) + ADR (14) land with/just before US2 so compaction
  actually reduces occupancy.
- **US2 (/compact)** = items 8/registry + the toolbar compact button (10) + docs (15–16).
- **US3 (suggester)** = items 8–10 (menu UX). US2's toolbar button keeps `/compact` usable if
  US3 slips.

## Structure Decision

Single frontend app (`frontend/`). New code follows existing folders: entities in
`src/entities/`, pure logic in `src/lib/chat/`, components in `src/components/chat/`, hook edit
in `src/hooks/chat/`, config in `src/env.ts` + `src/lib/config.ts`, docs in
`src/app/docs/sections/` + `docs/design-docs/`.
