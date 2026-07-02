# Contracts: Dev-tools SSE Replay

Two internal contracts: the client **stream-source API** and the **UI control**. No network/HTTP
contract exists (replay is client-only, Principle I/III).

## 1. Shared recording module — `lib/stream/recording.ts` (pure)

```ts
export const TEXT_DELAY_MS = 20;
export const TOOL_DELAY_MS = 400;

/** Split raw SSE text into frames, each carrying its concatenated `data:` payload. */
export function parseFrames(text: string): string[];

/** Tool frames (function_call / function_call_output) stream slower than text. */
export function delayFor(payload: string, timing?: { textDelayMs: number; toolDelayMs: number }): number;
```

- Behavior identical to the current `route.dev.ts` functions (moved verbatim; `delayFor` gains an
  optional timing override defaulting to the constants).
- MUST contain **no** `node:*` imports (client-safe). `route.dev.ts` imports from here (FR-018).

## 2. Replay stream source — `lib/stream/replay.ts`

```ts
export interface ReplayTiming { textDelayMs: number; toolDelayMs: number; speed: number; }

export interface ReplayHandle {
  pause(): void;
  resume(): void;
  setSpeed(speed: number): void;
  abort(): void;               // settle to one "abort" terminal (idempotent)
  readonly status: "playing" | "paused" | "done";
}

export interface StreamReplayOptions {
  recording: string;
  handlers: ChatStreamHandlers;      // same interface streamSSE uses (onEvent/onClose)
  timing?: Partial<ReplayTiming>;    // defaults: TEXT/TOOL_DELAY_MS, speed 1
  sleep?: (ms: number) => Promise<void>;  // injectable for tests
}

export function streamReplay(options: StreamReplayOptions): ReplayHandle;
```

**Contract (mirrors `streamSSE`)**
- Reuses `createResponsesParser()`; each JSON frame → `parser.map(json)` → `handlers.onEvent` (FR-012).
- Emits **exactly one** `handlers.onClose(reason)`:
  - `"done"` — final frame processed or a parser `done` event.
  - `"error"` — a parser `error` event, or an empty/all-malformed recording (FR-025). Error events also
    route to the persistent toast via the same `onEvent` path as live streaming.
  - `"abort"` — `abort()` called (mode-off / cancel), partial output retained (FR-013).
- `pause()` suspends before the next frame's `onEvent`; renders **zero** frames while paused and emits
  **no** terminal (FR-010). `resume()` continues from the same position without re-emitting shown
  frames.
- Per-frame wait = `delayFor(frame, timing) / max(speed, minSpeed)`; invalid timing clamped so it can
  never hang or busy-loop (FR-016). `setSpeed` affects only subsequent frames.
- Malformed individual frames are skipped, not fatal (FR-025).

## 3. `useChat` surface additions (via `UseChatResult` → `ChatContextValue`)

```ts
replayMode: boolean;
toggleReplayMode(): void;                       // resets to a fresh non-persisted conversation
replaySession: { status: "idle" | "playing" | "paused"; source: "default" | "upload";
                 fileName?: string; textDelayMs: number; toolDelayMs: number; speed: number;
                 error: string | null };
replayPlay(): void;                             // start (from beginning) or resume; no-op without valid source
replayPause(): void;
replaySetSource(src: { kind: "default" } | { kind: "upload"; file: File }): void;
replaySetTiming(t: { textDelayMs?: number; toolDelayMs?: number }): void;
replayResetTiming(): void;
replaySetSpeed(speed: 0.5 | 1 | 2 | 4): void;
```

- Replay turns MUST NOT be persisted (FR-020). `cancel()` also aborts an active replay.

## 4. UI contract — `ReplayControl` (`components/chat/replay-control.tsx`)

- Rendered by `ChatScreen` **in place of** `ChatComposer`, inside the identical wrapper
  `<div className="mx-auto w-full max-w-3xl px-4 pb-4">`, only when `replayMode` is true (FR-002).
- MUST occupy the **same footprint** as the composer (same width/min-height/padding) → **0px** layout
  shift on toggle (FR-002a, SC-007). Continues to dock the same `TodoCard` strip above the controls so
  content above the input is unchanged.
- Exposes: **source** selector (Default / Upload `.txt`), **Play**, **Pause**, **delay** inputs (text &
  tool) with **reset**, and **speed** select (×0.5/×1/×2/×4) (FR-004/FR-015).
- Play disabled until a valid source is available; upload validated (`.txt`, size) with inline error;
  empty/unreadable file blocks Play with a clear message (FR-008/FR-009, edge cases).
- Forwards `className` via trailing `cn(...)`; uses existing tokens/`data-slot` (Principle V).

## 5. Sidebar toggle — `NavDevTools`

- Rendered by `AppSidebar` only when `config.devToolsEnabled` is true (FR-026). Its sole job is to
  toggle `replayMode` on/off (replaces today's test-toast dropdown).

## 6. Build & recording contracts

- `scripts/gen-replay-recording.mjs`: `sse-recordings/default.txt` → `default-recording.generated.ts`
  exporting `DEFAULT_REPLAY_RECORDING: string`. Runs at the start of `build:embed` and `build:manual`
  (FR-023). Committed output must match a fresh run.
- `scripts/strip-recording-images.mjs`: local capture → base64-stripped `default.txt` (FR-021/FR-022);
  never prints base64; output contains **zero** `data:image/...;base64,` payloads (SC-004).
