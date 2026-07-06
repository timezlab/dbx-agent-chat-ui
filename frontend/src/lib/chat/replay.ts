import type { ChatStreamHandlers } from "@/lib/chat/transport";
import { createResponsesParser } from "./responses";
import {
  TEXT_DELAY_MS,
  TOOL_DELAY_MS,
  delayFor,
  parseFrames,
  type FrameTiming,
} from "./recording";

/**
 * Client-side **replay stream source** (D-R2). Plays a recorded Responses-SSE stream
 * entirely in the browser — no network, no `fetch` — driving the *same*
 * `createResponsesParser` → `ChatStreamEvent` path as the live `streamSSE`, so rendering
 * is identical (FR-012). It mirrors `streamSSE`'s "exactly one terminal" contract
 * (FR-014) but returns a richer {@link ReplayHandle} that also supports pause/resume and
 * a live speed change — controls a bare `AbortController` cannot express (see the plan's
 * Complexity Tracking / Principle IV note).
 */

export interface ReplayTiming extends FrameTiming {
  /** Multiplier over the base delays: `effectiveDelay = baseDelay / speed`. */
  speed: number;
}

export interface ReplayHandle {
  /** Suspend before the next frame; renders zero frames and emits no terminal. */
  pause(): void;
  /** Resume from the paused position without re-emitting shown frames. */
  resume(): void;
  /** Change the speed multiplier; applies to subsequent frames only. */
  setSpeed(speed: number): void;
  /** Settle to a single `"abort"` terminal (idempotent). */
  abort(): void;
  readonly status: "playing" | "paused" | "done";
}

export interface StreamReplayOptions {
  recording: string;
  /** Same handler shape `streamSSE` uses (`onEvent` / `onClose`). */
  handlers: ChatStreamHandlers;
  /** Base timing + speed; defaults: TEXT/TOOL_DELAY_MS, speed 1. */
  timing?: Partial<ReplayTiming>;
  /** Injectable clock for tests; defaults to `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
}

const MIN_SPEED = 0.1;
const MAX_SPEED = 100;
const MAX_DELAY_MS = 60_000;

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(Math.max(Number.isFinite(n) ? n : lo, lo), hi);

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function streamReplay(options: StreamReplayOptions): ReplayHandle {
  const { recording, handlers } = options;
  const sleep = options.sleep ?? defaultSleep;
  const parser = createResponsesParser();

  // Clamped timing. Base delays are read per-frame; speed can change live.
  const textDelayMs = clamp(options.timing?.textDelayMs ?? TEXT_DELAY_MS, 0, MAX_DELAY_MS);
  const toolDelayMs = clamp(options.timing?.toolDelayMs ?? TOOL_DELAY_MS, 0, MAX_DELAY_MS);
  let speed = clamp(options.timing?.speed ?? 1, MIN_SPEED, MAX_SPEED);

  let status: "playing" | "paused" | "done" = "playing";
  let aborted = false;
  let paused = false;
  let resumeWaiters: Array<() => void> = [];

  let closed = false;
  const close = (reason: "done" | "error" | "abort") => {
    if (closed) return;
    closed = true;
    status = "done";
    handlers.onClose?.(reason);
  };

  // Block while paused; wakes on resume() or abort().
  const waitWhilePaused = async () => {
    while (paused && !aborted) {
      await new Promise<void>((resolve) => resumeWaiters.push(resolve));
    }
  };
  const wake = () => {
    const waiters = resumeWaiters;
    resumeWaiters = [];
    for (const w of waiters) w();
  };

  const run = async () => {
    const frames = parseFrames(recording);
    let sawValid = false;

    for (const frame of frames) {
      // Guard pause/abort BEFORE the delay and BEFORE emitting, so a paused replay
      // renders zero frames and emits no terminal (FR-010).
      await waitWhilePaused();
      if (aborted) break;

      let json: unknown;
      try {
        json = JSON.parse(frame);
      } catch {
        continue; // malformed individual frame → skip, not fatal (FR-025)
      }
      sawValid = true;

      await sleep(delayFor(frame, { textDelayMs, toolDelayMs }) / speed);
      await waitWhilePaused();
      if (aborted) break;

      for (const event of parser.map(json)) {
        handlers.onEvent(event);
        if (event.type === "done") return close("done");
        if (event.type === "error") return close("error");
      }
    }

    if (aborted) return; // abort() already emitted the terminal
    // End of frames with no explicit terminal: done if we saw any valid frame,
    // error if the recording yielded nothing playable (FR-025).
    close(sawValid ? "done" : "error");
  };

  void run();

  return {
    pause() {
      if (aborted || closed || paused) return;
      paused = true;
      status = "paused";
    },
    resume() {
      if (aborted || closed || !paused) return;
      paused = false;
      status = "playing";
      wake();
    },
    setSpeed(next: number) {
      speed = clamp(next, MIN_SPEED, MAX_SPEED);
    },
    abort() {
      if (closed) return;
      aborted = true;
      paused = false;
      wake();
      close("abort");
    },
    get status() {
      return status;
    },
  };
}
