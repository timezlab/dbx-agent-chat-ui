"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import type { Attachment, ChatSession, Message } from "@/entities";
import { reduceStreamEvent } from "@/lib/chat/reducer";
import { streamReplay, type ReplayHandle } from "@/lib/chat/replay";
import { TEXT_DELAY_MS, TOOL_DELAY_MS } from "@/lib/chat/recording";
import { DEFAULT_REPLAY_RECORDING } from "@/lib/chat/recordings/default-recording.generated";

/**
 * Dev-tools Replay (feature 002), extracted from `useChat` to keep that hook focused on
 * live chat. Replay drives the SAME `conversation` state through the SAME reducer +
 * terminal handler (`handleClose`) as live streaming, so tool timelines / reasoning /
 * markdown render identically (FR-012). Everything here is ephemeral and NEVER recorded
 * to history (FR-020 / SC-006) — `useChat`'s terminal-settle effect skips while
 * `isReplayActive()` is true.
 */

/** Playback speed multiplier presets (D-R3). */
export type ReplaySpeed = 0.5 | 1 | 2 | 4;

/** Which recording source drives replay. Upload carries the client-read text (D-R4). */
export type ReplaySource =
  | { kind: "default" }
  | { kind: "upload"; fileName: string; text: string };

/** Transport-style state of one replay playback (ephemeral; never persisted). */
export interface ReplaySession {
  status: "idle" | "playing" | "paused";
  source: "default" | "upload";
  fileName?: string;
  textDelayMs: number;
  toolDelayMs: number;
  speed: ReplaySpeed;
  error: string | null;
}

const REPLAY_MAX_DELAY_MS = 60_000;
const clampReplayDelay = (n: number): number =>
  Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), REPLAY_MAX_DELAY_MS);

function freshReplaySession(): ReplaySession {
  return {
    status: "idle",
    source: "default",
    textDelayMs: TEXT_DELAY_MS,
    toolDelayMs: TOOL_DELAY_MS,
    speed: 1,
    error: null,
  };
}

/** Shared seams from `useChat` so replay drives the same conversation + terminal path. */
export interface UseReplayDeps {
  setConversation: React.Dispatch<React.SetStateAction<ChatSession>>;
  makeUser: (
    text: string,
    attachments?: Attachment[],
    status?: Message["status"],
  ) => Message;
  makeAssistant: () => Message;
  handleClose: (finishedId: string, reason: "done" | "error" | "abort") => void;
  generateId: () => string;
  /** Abort any live (non-replay) generation when entering/leaving replay mode. */
  abortActiveGeneration: () => void;
}

export interface UseReplayResult {
  /** Whether Replay mode is on (composer swapped for the Replay control, FR-002). */
  replayMode: boolean;
  /** The current replay playback state. */
  replaySession: ReplaySession;
  /** Toggle Replay mode; resets to a fresh, non-persisted conversation (D-R4). */
  toggleReplayMode: () => void;
  /** Start playback from the beginning, or resume when paused; no-op without a source. */
  replayPlay: () => void;
  /** Suspend playback at the current frame (no terminal, FR-010). */
  replayPause: () => void;
  /** Select the recording source (default or a client-read upload). */
  replaySetSource: (source: ReplaySource) => void;
  /** Edit the base per-frame delays (clamped to a safe range, FR-016). */
  replaySetTiming: (timing: {
    textDelayMs?: number;
    toolDelayMs?: number;
  }) => void;
  /** Reset delays to defaults and speed to ×1. */
  replayResetTiming: () => void;
  /** Change the speed multiplier; applies to subsequent frames (FR-015/FR-016). */
  replaySetSpeed: (speed: ReplaySpeed) => void;
  /** True while replay mode is on — the terminal-settle guard reads this. */
  isReplayActive: () => boolean;
  /** Abort an active replay playback (called by `useChat.cancel`). */
  abortReplay: () => void;
}

export function useReplay(deps: UseReplayDeps): UseReplayResult {
  const {
    setConversation,
    makeUser,
    makeAssistant,
    handleClose,
    generateId,
    abortActiveGeneration,
  } = deps;

  // Ephemeral; the recording text lives in a ref so a multi-MB upload never sits in React
  // state / triggers renders.
  const [replayMode, setReplayMode] = useState(false);
  const replayModeRef = useRef(false);
  useEffect(() => {
    replayModeRef.current = replayMode;
  });
  const [replaySession, setReplaySession] =
    useState<ReplaySession>(freshReplaySession);
  const replayHandleRef = useRef<ReplayHandle | null>(null);
  const replayRecordingRef = useRef<string>(DEFAULT_REPLAY_RECORDING);

  const toggleReplayMode = useCallback(() => {
    // Abort whatever is streaming (live or replay) and reset to a fresh in-memory
    // conversation. Recording stays suppressed (replayModeRef), so nothing resurrects.
    abortActiveGeneration();
    replayHandleRef.current?.abort();
    replayHandleRef.current = null;

    const next = !replayModeRef.current;
    replayModeRef.current = next; // sync so the settle guard reads the new value
    setReplayMode(next);
    setReplaySession(freshReplaySession());
    replayRecordingRef.current = DEFAULT_REPLAY_RECORDING;
    setConversation({
      id: generateId(),
      messages: [],
      activeId: null,
      queue: [],
      status: "idle",
    });
  }, [abortActiveGeneration, generateId, setConversation]);

  const replaySetSource = useCallback((source: ReplaySource) => {
    if (source.kind === "default") {
      replayRecordingRef.current = DEFAULT_REPLAY_RECORDING;
      setReplaySession((s) => ({
        ...s,
        source: "default",
        fileName: undefined,
        error: null,
      }));
      return;
    }
    replayRecordingRef.current = source.text;
    setReplaySession((s) => ({
      ...s,
      source: "upload",
      fileName: source.fileName,
      // A file that read as empty blocks Play with a clear message (edge cases).
      error: source.text.trim().length > 0 ? null : "The selected file is empty.",
    }));
  }, []);

  const replaySetTiming = useCallback(
    (timing: { textDelayMs?: number; toolDelayMs?: number }) => {
      setReplaySession((s) => ({
        ...s,
        textDelayMs:
          timing.textDelayMs != null
            ? clampReplayDelay(timing.textDelayMs)
            : s.textDelayMs,
        toolDelayMs:
          timing.toolDelayMs != null
            ? clampReplayDelay(timing.toolDelayMs)
            : s.toolDelayMs,
      }));
    },
    [],
  );

  const replayResetTiming = useCallback(() => {
    setReplaySession((s) => ({
      ...s,
      textDelayMs: TEXT_DELAY_MS,
      toolDelayMs: TOOL_DELAY_MS,
      speed: 1,
    }));
    replayHandleRef.current?.setSpeed(1);
  }, []);

  const replaySetSpeed = useCallback((speed: ReplaySpeed) => {
    // Live speed change reaches the active playback; applies to subsequent frames only.
    replayHandleRef.current?.setSpeed(speed);
    setReplaySession((s) => ({ ...s, speed }));
  }, []);

  const replayPause = useCallback(() => {
    replayHandleRef.current?.pause();
    setReplaySession((s) =>
      s.status === "playing" ? { ...s, status: "paused" } : s,
    );
  }, []);

  const replayPlay = useCallback(() => {
    // Resume a paused playback in place (no re-render of shown frames, FR-010).
    if (replaySession.status === "paused" && replayHandleRef.current) {
      replayHandleRef.current.resume();
      setReplaySession((s) => ({ ...s, status: "playing" }));
      return;
    }
    if (replaySession.status === "playing") return; // already running

    const recording = replayRecordingRef.current;
    if (!recording || recording.trim().length === 0) {
      setReplaySession((s) => ({ ...s, error: "No recording selected." }));
      return;
    }

    // Abort any prior handle, then create the labelled placeholder user turn + a
    // streaming assistant turn (FR-011).
    replayHandleRef.current?.abort();
    const label =
      replaySession.source === "upload"
        ? `Replay: ${replaySession.fileName ?? "uploaded recording"}`
        : "Replay: default recording";
    const user = makeUser(label);
    const assistant = makeAssistant();
    const assistantId = assistant.id;
    setConversation((prev) => ({
      ...prev,
      messages: [...prev.messages, user, assistant],
      activeId: assistantId,
      status: "streaming",
    }));

    const handle = streamReplay({
      recording,
      timing: {
        textDelayMs: replaySession.textDelayMs,
        toolDelayMs: replaySession.toolDelayMs,
        speed: replaySession.speed,
      },
      handlers: {
        onEvent: (event) => {
          // Same detailed error toast + reducer path as live streaming.
          if (event.type === "error") {
            toast.error(event.message, { autoClose: false });
          }
          setConversation((prev) => reduceStreamEvent(prev, event));
        },
        onClose: (reason) => {
          handleClose(assistantId, reason);
          replayHandleRef.current = null;
          setReplaySession((s) => ({ ...s, status: "idle" }));
        },
      },
    });
    replayHandleRef.current = handle;
    setReplaySession((s) => ({ ...s, status: "playing", error: null }));
  }, [replaySession, makeUser, makeAssistant, handleClose, setConversation]);

  const isReplayActive = useCallback(() => replayModeRef.current, []);
  const abortReplay = useCallback(() => replayHandleRef.current?.abort(), []);

  return {
    replayMode,
    replaySession,
    toggleReplayMode,
    replayPlay,
    replayPause,
    replaySetSource,
    replaySetTiming,
    replayResetTiming,
    replaySetSpeed,
    isReplayActive,
    abortReplay,
  };
}

export default useReplay;
