# Phase 1 Data Model: Dev-tools SSE Replay

All entities are **ephemeral in-memory** (no persistence, FR-020). No new stored/DB shape is
introduced; existing `Conversation`/`Message` entities are reused unchanged for rendering.

## Recording (input data)

A plain-text document of Responses-SSE `data:` frames (the shape the mock already produces and the
live transport parses).

| Field | Type | Notes |
|-------|------|-------|
| source kind | `"default" \| "upload"` | Which source produced the text. |
| text | `string` | Raw SSE text. Bundled default comes from `DEFAULT_REPLAY_RECORDING`; upload from `FileReader`. |
| file name | `string?` | Upload only — shown in the control. |
| file size | `number?` | Upload only — shown in the control; validated against the max. |

**Validation**
- Upload MUST be `.txt` / plain text and within a conservative max size (low-MB); else rejected with a
  clear inline message before playback (FR-008, edge cases).
- `parseFrames(text)` yielding **zero** frames ⇒ surface a clear error, no false replay (FR-025).
- No embedded base64 image data in the committed default (FR-021 / SC-004).

## ReplaySession (transport-style playback state)

The state of one playback, held in `useChat`.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| status | `"idle" \| "playing" \| "paused"` | `idle` | Distinct from the chat `status`; drives play/pause UI. |
| source | `Recording` ref | default | Selected source; upload requires a valid file before Play. |
| textDelayMs | `number` | `20` | Base text-frame delay (mock default, FR-017); editable, resettable. |
| toolDelayMs | `number` | `400` | Base tool-frame delay (mock default); editable, resettable. |
| speed | `0.5 \| 1 \| 2 \| 4` | `1` | Multiplier: `effectiveDelay = baseDelay / speed` (FR-015/FR-016). |
| handle | `ReplayHandle \| null` | `null` | The active `streamReplay` handle (pause/resume/setSpeed/abort). |

**Rules / transitions**
- `idle → playing` on Play with a valid source (creates the labelled user turn + assistant turn).
- `playing → paused` on Pause (suspends frame emission; **no** terminal; partial output retained,
  FR-010).
- `paused → playing` on Play (resume from position; no re-render of shown frames).
- `playing/paused → idle` on completion, stop/cancel, or replay-mode-off — settling to exactly **one**
  terminal (`complete` / `stopped` / `error`), FR-014.
- Timing edits validated/clamped to a safe range (FR-016). A speed change applies to subsequent frames
  only.

## Replay mode (UI state)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| replayMode | `boolean` | `false` | When on, composer is replaced by `ReplayControl` (FR-002). Toggling resets to a fresh, non-persisted conversation (D-R4). |

Gated by `config.devToolsEnabled` (`NEXT_PUBLIC_DEV_TOOLS`, default off, FR-026) — when the flag is
off the toggle is not rendered, so `replayMode` can never become `true`.

## Config additions

| Entity | Field | Type | Source |
|--------|-------|------|--------|
| `CapabilityConfig` | `devToolsEnabled` | `boolean` | `parseDevToolsEnabled(NEXT_PUBLIC_DEV_TOOLS)` in `lib/config.ts`; added to the zod schema in `entities/config.ts`. Default `false`. |

## Terminal-outcome invariant (shared with live streaming)

Every replay resolves to exactly one of `complete` (final frame processed), `stopped` (aborted /
mode-off), or `error` (error frame or empty/malformed recording). Pause/resume are **not** terminals.
This mirrors the `streamSSE` contract enforced today in `use-chat.ts`.
