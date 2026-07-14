"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import type { Attachment, ChatSession, Message } from "@/entities";
import { reduceStreamEvent } from "@/lib/chat/reducer";
import { streamReplay, type ReplayHandle } from "@/lib/chat/replay";
import {
  TEXT_DELAY_MS,
  TOOL_DELAY_MS,
  extractUserRequest,
} from "@/lib/chat/recording";
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
  /**
   * The question being "typed" into the composer during the pre-stream typing effect
   * (FR-029), or `null` when no typing is in progress. The composer renders this read-only
   * while non-null; it clears the instant the user turn is committed.
   */
  replayTypingText: string | null;
  /** Toggle Replay mode; resets to a fresh, non-persisted conversation (D-R4). */
  toggleReplayMode: () => void;
  /** Start playback from the beginning, or resume when paused; no-op without a source. */
  replayPlay: () => void;
  /** Suspend playback at the current frame (no terminal, FR-010). */
  replayPause: () => void;
  /**
   * Clear the replayed conversation — a fresh, empty chat screen — while STAYING in Replay
   * mode with the current source selected, so the same recording can be replayed again.
   */
  replayReset: () => void;
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

  // Latest session read imperatively by the async typing→stream handoff, so timing/speed
  // edits made while a question is still typing apply when the stream actually starts.
  const replaySessionRef = useRef(replaySession);
  useEffect(() => {
    replaySessionRef.current = replaySession;
  });

  // Pre-stream typing effect (FR-029): the embedded question is "typed" into the composer
  // char-by-char before the user turn is committed. Null ⇒ no typing in flight.
  const [replayTypingText, setReplayTypingText] = useState<string | null>(null);
  const typingRef = useRef<{
    question: string;
    index: number;
    perCharDelayMs: number;
    paused: boolean;
    aborted: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    onDone: () => void;
  } | null>(null);

  const cancelTyping = useCallback(() => {
    const t = typingRef.current;
    if (t?.timer != null) clearTimeout(t.timer);
    typingRef.current = null;
    setReplayTypingText(null);
  }, []);

  const toggleReplayMode = useCallback(() => {
    // Abort whatever is streaming (live or replay) and reset to a fresh in-memory
    // conversation. Recording stays suppressed (replayModeRef), so nothing resurrects.
    abortActiveGeneration();
    replayHandleRef.current?.abort();
    replayHandleRef.current = null;
    cancelTyping();

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
  }, [abortActiveGeneration, generateId, setConversation, cancelTyping]);

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

  // Commit the user turn (`userText`) + a streaming assistant turn, then drive the recording
  // through the SAME reducer/terminal path as live streaming (FR-011/FR-012). Reads timing
  // from the ref so edits made mid-typing take effect when the stream actually starts.
  const commitAndStream = useCallback(
    (userText: string) => {
      typingRef.current = null;
      setReplayTypingText(null);

      const recording = replayRecordingRef.current;
      replayHandleRef.current?.abort();
      const user = makeUser(userText);
      const assistant = makeAssistant();
      const assistantId = assistant.id;
      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, user, assistant],
        activeId: assistantId,
        status: "streaming",
      }));

      const session = replaySessionRef.current;
      const handle = streamReplay({
        recording,
        timing: {
          textDelayMs: session.textDelayMs,
          toolDelayMs: session.toolDelayMs,
          speed: session.speed,
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
    },
    [makeUser, makeAssistant, handleClose, setConversation],
  );

  // One character of the pre-stream typing effect. Pauses/aborts are honored between chars;
  // reaching the end hands off to `onDone` (which commits the user turn + starts the stream).
  const stepTyping = useCallback(function step() {
    const t = typingRef.current;
    if (!t || t.aborted || t.paused) return;
    t.index += 1;
    setReplayTypingText(t.question.slice(0, t.index));
    if (t.index >= t.question.length) {
      t.timer = null;
      t.onDone();
      return;
    }
    t.timer = setTimeout(step, t.perCharDelayMs);
  }, []);

  const replayPause = useCallback(() => {
    // Pausing mid-typing freezes the typing effect; otherwise it pauses the frame stream.
    const t = typingRef.current;
    if (t && !t.aborted) {
      t.paused = true;
      if (t.timer != null) {
        clearTimeout(t.timer);
        t.timer = null;
      }
    } else {
      replayHandleRef.current?.pause();
    }
    setReplaySession((s) =>
      s.status === "playing" ? { ...s, status: "paused" } : s,
    );
  }, []);

  const replayPlay = useCallback(() => {
    // Resume a paused playback in place — either the typing effect or the frame stream
    // (no re-render of shown frames, FR-010).
    if (replaySession.status === "paused") {
      const t = typingRef.current;
      if (t && !t.aborted) {
        t.paused = false;
        setReplaySession((s) => ({ ...s, status: "playing" }));
        stepTyping();
        return;
      }
      if (replayHandleRef.current) {
        replayHandleRef.current.resume();
        setReplaySession((s) => ({ ...s, status: "playing" }));
        return;
      }
    }
    if (replaySession.status === "playing") return; // already running

    const recording = replayRecordingRef.current;
    if (!recording || recording.trim().length === 0) {
      setReplaySession((s) => ({ ...s, error: "No recording selected." }));
      return;
    }

    // Abort any prior handle/typing before starting a new playback.
    replayHandleRef.current?.abort();
    cancelTyping();

    // Prefer the question embedded in the recording (FR-028); fall back to the filename
    // placeholder for legacy recordings without a sentinel (FR-011).
    const question = extractUserRequest(recording);
    if (question) {
      // Type the question into the composer first (FR-029), then commit + stream.
      const perCharDelayMs =
        clampReplayDelay(replaySession.textDelayMs) /
        Math.max(replaySession.speed, 0.1);
      typingRef.current = {
        question,
        index: 0,
        perCharDelayMs,
        paused: false,
        aborted: false,
        timer: null,
        onDone: () => commitAndStream(question),
      };
      setReplayTypingText("");
      setReplaySession((s) => ({ ...s, status: "playing", error: null }));
      stepTyping();
      return;
    }

    const label =
      replaySession.source === "upload"
        ? `Replay: ${replaySession.fileName ?? "uploaded recording"}`
        : "Replay: default recording";
    commitAndStream(label);
  }, [replaySession, cancelTyping, commitAndStream, stepTyping]);

  const replayReset = useCallback(() => {
    // Stop any playback/typing and wipe the transcript, but stay in Replay mode with the
    // current source — a "new chat" for replay.
    replayHandleRef.current?.abort();
    replayHandleRef.current = null;
    cancelTyping();
    setReplaySession((s) => ({ ...s, status: "idle", error: null }));
    setConversation({
      id: generateId(),
      messages: [],
      activeId: null,
      queue: [],
      status: "idle",
    });
  }, [cancelTyping, generateId, setConversation]);

  const isReplayActive = useCallback(() => replayModeRef.current, []);
  const abortReplay = useCallback(() => {
    cancelTyping();
    replayHandleRef.current?.abort();
  }, [cancelTyping]);

  return {
    replayMode,
    replaySession,
    replayTypingText,
    toggleReplayMode,
    replayPlay,
    replayPause,
    replayReset,
    replaySetSource,
    replaySetTiming,
    replayResetTiming,
    replaySetSpeed,
    isReplayActive,
    abortReplay,
  };
}

export default useReplay;
