# Phase 0 Research: Dev-tools SSE Replay

All Technical Context items were resolvable from the existing codebase; no `NEEDS CLARIFICATION`
remained after `/speckit-specify`. This document records the design decisions that shape the plan.

## D-R1 — Shared frame-parsing & delay logic

- **Decision**: Extract `parseFrames`, `delayFor`, `TEXT_DELAY_MS`, `TOOL_DELAY_MS` from
  `src/app/api/chat/route.dev.ts` into a new **pure** module `src/lib/stream/recording.ts`. The dev
  route imports them; `streamReplay` imports them. No `node:*` imports in the shared module.
- **Rationale**: FR-017/FR-018 require a single source of truth for parsing and default timing. The
  existing functions are already pure (string in, string/number out), so extraction is mechanical and
  keeps the module client-safe (Principle III — no node deps leak to the browser bundle).
- **Alternatives considered**: Duplicating the logic in the client (rejected — divergence risk,
  violates FR-018); importing from `route.dev.ts` directly (rejected — it imports `node:fs` and is
  gated out of the static build).

## D-R2 — Client replay stream source (`streamReplay`)

- **Decision**: New `src/lib/stream/replay.ts` exports `streamReplay(recording, handlers, options)`
  returning a **`ReplayHandle`** — a superset of the abort contract that also exposes
  `pause()`, `resume()`, `setSpeed(n)`, and `abort()`. Internally it runs an async frame loop:
  `parseFrames` → for each frame `await sleep(delayFor(frame) / speed)` → guard paused (await a resume
  promise) → guard aborted → `createResponsesParser().map(json)` → `handlers.onEvent`; done/error
  events and end-of-frames each trigger **exactly one** `handlers.onClose(reason)` terminal.
- **Rationale**: Mirrors `streamSSE`'s single-terminal contract (FR-014) and reuses the same parser so
  rendering is identical (FR-012). Pause is *not* a terminal (FR-010); abort settles to `"abort"`
  (→ `stopped`, FR-013). The injected `sleep`/clock keeps timing testable with fake timers.
- **Alternatives considered**: Reusing `streamSSE` with a fake `fetch` that yields frames (rejected —
  cannot pause/resume mid-stream; couples replay to network machinery); a generator without a handle
  (rejected — no way to pause/resume/speed from the UI).

## D-R3 — Timing & speed model

- **Decision**: Base delays default to the mock's `TEXT_DELAY_MS=20` / `TOOL_DELAY_MS=400` (FR-017),
  editable and resettable in the control. **Speed** is a multiplier applied as
  `effectiveDelay = baseDelay / speed`, presets ×0.5 / ×1 / ×2 / ×4 (default ×1). Inputs are clamped to
  a safe range (delays ≥ 0 and ≤ a sane max; speed to the preset set) so playback can never hang or
  busy-loop (FR-016). A speed change updates the multiplier read at the *next* frame, never corrupting
  the current position (FR-016, US4 scenario 5).
- **Rationale**: Multiplicative speed over shared base delays keeps default pacing familiar (FR-017)
  and the math trivial to reason about and test.
- **Alternatives considered**: Absolute per-frame ms only (rejected — no quick global speed-up);
  independent speed per frame type (rejected — over-complex for a dev tool).

## D-R4 — Isolated, non-persisted replay conversation

- **Decision**: Replay drives the **same** `useChat` conversation state (so it renders through the
  identical `MessageList`), but (a) `history.save` is **suppressed** while replay mode is active, and
  (b) entering and exiting replay mode resets to a fresh in-memory conversation. Replayed turns are
  therefore never written to `HistoryProvider`/localStorage and cannot resurrect on reload.
- **Rationale**: Satisfies FR-020 / SC-006 (0% resurrection) with minimal surface area — one guard in
  the persistence effect plus a reset on toggle — while reusing the existing reducer, todo derivation,
  and message components unchanged.
- **Alternatives considered**: A parallel replay-only conversation store (rejected — duplicates state
  and the render wiring); tagging replay messages and filtering at save (rejected — leakier than a
  single mode guard). **Note for implement/clarify**: resetting on toggle clears any in-progress *real*
  conversation; acceptable for an explicit dev-mode switch, but flag it in the PR.

## D-R5 — `useChat` integration

- **Decision**: Extend `useChat` (the single owner of conversation state, `controllerRef`, reducer
  wiring, and the persistence effect) with: `replayMode` + `toggleReplayMode`, a `replaySession`
  (source, status, position-agnostic timing, speed), and actions `replayPlay/replayPause/
  replaySetSource/replaySetTiming/replaySetSpeed`. `replayPlay` creates a labelled placeholder user
  turn + an assistant turn, then calls `streamReplay` wired to the **same** `onEvent`
  (`reduceStreamEvent` + persistent error toast) and `onClose` (`handleClose`) used by
  `beginGeneration`. The `ReplayHandle` is stored so `cancel()`/mode-off abort it and pause/resume/speed
  reach it.
- **Rationale**: Reuses the proven terminal-handling and error path (FR-012/FR-014); avoids a second
  conversation owner. The existing queue-drain in `handleClose` is inert during replay (replay never
  enqueues).
- **Alternatives considered**: A separate `useReplay` hook owning its own conversation (rejected —
  would duplicate `MessageList` wiring and split the single-active-turn invariant).

## D-R6 — Bundling the default recording (generated `.ts`)

- **Decision**: `scripts/gen-replay-recording.mjs` reads `frontend/sse-recordings/default.txt` and
  writes `src/lib/stream/recordings/default-recording.generated.ts` exporting
  `export const DEFAULT_REPLAY_RECORDING = <JSON.stringify(contents)>`. The generated file is
  **committed** (dev works without running the script) and **regenerated** at the start of
  `build:embed` and `build:manual` so the bundled copy always matches the committed recording.
- **Rationale**: A JS string constant is bundler-agnostic and inlines automatically into the Vite
  single-file embed — zero runtime fetch (FR-006, FR-023, SC-005, embed self-containment edge case).
- **Alternatives considered**: `import raw from "...txt?raw"` (rejected — requires a Turbopack/webpack
  raw-loader rule and it is uncertain whether `next build` uses Turbopack here); `fetch("/default.txt")`
  (rejected — breaks embed self-containment and static purity).

## D-R7 — Regenerating `default.txt` (strip base64 images)

- **Decision**: `scripts/strip-recording-images.mjs` reads a local capture (default input
  `sse-recordings/rbg-performance-2026.txt`), parses each SSE frame's JSON (reusing the JSON-aware
  sticky-scan approach from `scripts/format-sse-recording.mjs`), strips base64 image markdown
  (`![alt](data:image/...;base64,...)` and `[chart](data:...)` link form) and any bare `[chart]`
  marker from text/delta fields, and overwrites the committed `sse-recordings/default.txt`. The script
  operates on parsed JSON only and **never prints base64** to stdout.
- **Rationale**: FR-021/FR-022/SC-004 — the committed default must be small, text-only, yet a realistic
  multi-tool/multi-turn stream. Base64 lives in only 4 frames of the capture (verified) and each image
  is fully contained in one frame, so per-frame stripping is safe.
- **Alternatives considered**: Hand-editing `default.txt` (rejected — not repeatable, risks reading
  base64); a blanket regex over the whole file ignoring frame structure (rejected — brittle across
  frame boundaries and JSON escaping).

## D-R8 — Dev-tools visibility flag

- **Decision**: Add `NEXT_PUBLIC_DEV_TOOLS` (`z.string().optional()`) to `env.ts`, parse it in
  `config.ts` via a boolean parser (mirroring `parseUploadEnabled`: `"1"/"true"/"yes"` ⇒ on) into
  `config.devToolsEnabled`, add it to `CapabilityConfig` (+ zod schema), expose through `ChatProvider`.
  `AppSidebar` renders `NavDevTools` only when `devToolsEnabled`; with the flag off there is no toggle
  and no way to enter replay mode. Default **off**.
- **Rationale**: FR-026 / Principle II — a non-secret build/deploy-time selector, uniform across dev,
  static-export, and embed (Vite `loadEnv` already forwards `NEXT_PUBLIC_*`).
- **Alternatives considered**: `process.env.NODE_ENV !== "production"` gate (rejected — a demo static
  deploy is a production build but still wants replay; the spec requires explicit opt-in).

## D-R9 — Replay control & composer-footprint parity

- **Decision**: New `ReplayControl` renders inside the *same* wrapper `ChatScreen` uses for the
  composer (`<div className="mx-auto w-full max-w-3xl px-4 pb-4">`); `ChatScreen` swaps
  `<ChatComposer>` ↔ `<ReplayControl>` on `replayMode`. `ReplayControl` reuses the composer's outer
  card structure/min-height and continues to dock the same `TodoCard` strip above its controls, so the
  content above the input is unchanged and there is **0px** layout shift on toggle (FR-002a, SC-007).
- **Rationale**: Rendering in the identical wrapper and mirroring the card shell is the most direct way
  to guarantee no layout shift; component tests assert the shared wrapper/structural classes.
- **Alternatives considered**: A modal/dialog replay panel (rejected by the updated spec — the control
  must *replace* the input inline); overlaying the control on the composer (rejected — double footprint,
  layout shift risk).
