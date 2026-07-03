"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import type {
  Attachment,
  CapabilityConfig,
  ChatRequestMessage,
  Conversation,
  ConversationSummary,
  Message,
} from "@/entities";
import { resolveConfig, isChatEndpointMissing } from "@/lib/config";
import { dequeue, enqueue, isBlank } from "@/lib/chat/queue";
import { reduceStreamEvent } from "@/lib/chat/reducer";
import { createChatTransport, type ChatTransport } from "@/lib/chat/transport";
import { streamReplay, type ReplayHandle } from "@/lib/stream/replay";
import { TEXT_DELAY_MS, TOOL_DELAY_MS } from "@/lib/stream/recording";
import { DEFAULT_REPLAY_RECORDING } from "@/lib/stream/recordings/default-recording.generated";
import { resolveHistory, type HistoryProvider } from "@/lib/history/provider";
import { resolveFeedback, type FeedbackSink } from "@/lib/feedback/sink";
import type { Feedback } from "@/entities";

export interface UseChatOptions {
  /** Public capability config; defaults to `resolveConfig()` (env-derived). */
  config?: CapabilityConfig;
  /** Transport port; defaults to `createChatTransport(config.chatEndpointUrl)`. Injectable for tests. */
  transport?: ChatTransport;
  /** Injected clock for `createdAt` (keeps pure code free of `Date.now()`). */
  now?: () => number;
  /** Injected id generator (stable, unique). */
  generateId?: () => string;
  /** History provider; defaults to `resolveHistory(config)`. Injectable for tests. */
  history?: HistoryProvider;
  /** Feedback sink; defaults to `resolveFeedback(config)`. Injectable for tests. */
  feedback?: FeedbackSink;
  /**
   * Selected agent id (US5). Rides along on every `ChatRequest.agentId`; null/undefined
   * ⇒ no agent id (default endpoint routing, FR-025/FR-026).
   */
  agentId?: string | null;
}

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

export interface UseChatResult {
  conversation: Conversation;
  messages: Message[];
  status: "idle" | "streaming";
  /** Readable inline notice when the chat endpoint is missing/unavailable (T055). */
  configError: string | null;
  /** Past conversations for the sidebar history list, newest-first (read-only). */
  conversations: ConversationSummary[];
  send: (text: string, attachments?: Attachment[]) => void;
  /** Abort the active generation; partial output is kept and marked `stopped` (US2). */
  cancel: () => void;
  /** Start a fresh, empty conversation (leaves saved history untouched, US4). */
  newConversation: () => void;
  /** Open a past conversation by id (aborts any active generation first). */
  selectConversation: (id: string) => void;
  /** Submit feedback for a reply; optimistically reflects the selection (US3). */
  submitFeedback: (feedback: Feedback) => Promise<void>;

  // --- Dev-tools Replay (feature 002) — all ephemeral, never persisted (FR-020) ---
  /** Whether Replay mode is on (composer swapped for the Replay control, FR-002). */
  replayMode: boolean;
  /** Toggle Replay mode; resets to a fresh, non-persisted conversation (D-R4). */
  toggleReplayMode: () => void;
  /** The current replay playback state. */
  replaySession: ReplaySession;
  /** Start playback from the beginning, or resume when paused; no-op without a source. */
  replayPlay: () => void;
  /** Suspend playback at the current frame (no terminal, FR-010). */
  replayPause: () => void;
  /** Select the recording source (default or a client-read upload). */
  replaySetSource: (source: ReplaySource) => void;
  /** Edit the base per-frame delays (clamped to a safe range, FR-016). */
  replaySetTiming: (timing: { textDelayMs?: number; toolDelayMs?: number }) => void;
  /** Reset delays to defaults and speed to ×1. */
  replayResetTiming: () => void;
  /** Change the speed multiplier; applies to subsequent frames (FR-015/FR-016). */
  replaySetSpeed: (speed: ReplaySpeed) => void;
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

function defaultId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Math.random().toString(36).slice(2)}`
  );
}

/** Flatten a message's text parts for the history sent back to the backend. */
function flattenText(message: Message): string {
  return message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");
}

function readableError(err: unknown): string {
  return err instanceof Error ? err.message : "Chat endpoint is unavailable.";
}

export function useChat(options: UseChatOptions = {}): UseChatResult {
  const config = useMemo(
    () => options.config ?? resolveConfig(),
    [options.config],
  );
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? defaultId;

  const transport = useMemo(
    () => options.transport ?? createChatTransport(config.chatEndpointUrl),
    [options.transport, config.chatEndpointUrl],
  );

  const history = useMemo(
    () => options.history ?? resolveHistory(config),
    [options.history, config],
  );

  const feedbackSink = useMemo(
    () => options.feedback ?? resolveFeedback(config),
    [options.feedback, config],
  );

  const [conversation, setConversation] = useState<Conversation>(() => ({
    id: generateId(),
    messages: [],
    activeId: null,
    queue: [],
    status: "idle",
  }));

  // Sidebar history list (summaries only). Refreshed on startup and after each save.
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  // --- Replay state (feature 002). Ephemeral; the recording text lives in a ref so a
  // multi-MB upload never sits in React state / triggers renders. ---
  const [replayMode, setReplayMode] = useState(false);
  const replayModeRef = useRef(false);
  useEffect(() => {
    replayModeRef.current = replayMode;
  });
  const [replaySession, setReplaySession] = useState<ReplaySession>(
    freshReplaySession,
  );
  const replayHandleRef = useRef<ReplayHandle | null>(null);
  const replayRecordingRef = useRef<string>(DEFAULT_REPLAY_RECORDING);

  // Pre-flight guard: no chat endpoint means nothing can stream (T055).
  const [configError, setConfigError] = useState<string | null>(() =>
    isChatEndpointMissing(config)
      ? "Chat endpoint is not configured (NEXT_PUBLIC_CHAT_ENDPOINT_URL). Point it at your agent or the mock-api script."
      : null,
  );

  // Latest committed conversation, read by imperative dispatch (avoids stale closures
  // and setState-inside-effect).
  const conversationRef = useRef(conversation);
  useEffect(() => {
    conversationRef.current = conversation;
  });

  // Load persisted history once on startup and hydrate a still-pristine session
  // (never clobber a chat the user already started while the async load was in
  // flight). Async setState after an await is a legitimate external-sync effect.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;
    void (async () => {
      const list = await history.list().catch(() => []);
      if (cancelled) return;
      setConversations(list);
      // Restore the most recent conversation into a still-pristine session (never
      // clobber a chat the user already started while the async load was in flight).
      const restored = list.length
        ? await history.load(list[0].id).catch(() => null)
        : await history.load().catch(() => null);
      if (cancelled || !restored) return;
      setConversation((prev) =>
        prev.messages.length === 0 && prev.status === "idle" && !prev.activeId
          ? restored
          : prev,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [history]);

  // Persist on each terminal turn transition (streaming → idle with content), so a
  // reload restores the last settled conversation (FR-018..FR-020, D9).
  const prevStatusRef = useRef(conversation.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = conversation.status;
    if (
      prev === "streaming" &&
      conversation.status === "idle" &&
      conversation.messages.length > 0 &&
      // Replay turns are NEVER persisted (FR-020 / SC-006) — the whole point of replay
      // is a client-only, non-resurrecting playback.
      !replayModeRef.current
    ) {
      // Persist, then refresh the sidebar list so the just-settled turn shows up (new
      // conversation) or moves to the top (updated one).
      void history
        .save(conversation)
        .then(() => history.list())
        .then(setConversations)
        .catch(() => {});
    }
  }, [conversation, history]);

  // Selected agent id, read imperatively at send time so a mid-session change of agent
  // takes effect on the next request without re-creating the transport callbacks.
  const agentIdRef = useRef<string | null>(options.agentId ?? null);
  useEffect(() => {
    agentIdRef.current = options.agentId ?? null;
  });

  const controllerRef = useRef<AbortController | null>(null);
  // Indirection to break the handleClose ↔ beginGeneration mutual reference:
  // handleClose (defined first) calls the latest beginGeneration through this ref,
  // which is kept current below once beginGeneration exists.
  const beginGenerationRef = useRef<
    (assistantId: string, history: ChatRequestMessage[]) => void
  >(() => {});

  const makeUser = useCallback(
    (
      text: string,
      attachments: Attachment[] = [],
      status: Message["status"] = "complete",
    ): Message => ({
      id: generateId(),
      role: "user",
      parts: [{ type: "text", text }],
      attachments,
      // A real (dispatched) user turn is "complete". Still-queued turns are not built
      // here — they live in `queue` and are rendered from there as pending bubbles.
      status,
      error: null,
      feedback: null,
      createdAt: now(),
    }),
    [generateId, now],
  );

  const makeAssistant = useCallback(
    (): Message => ({
      id: generateId(),
      role: "assistant",
      parts: [],
      attachments: [],
      status: "streaming",
      error: null,
      feedback: null,
      createdAt: now(),
    }),
    [generateId, now],
  );

  const handleClose = useCallback(
    (finishedId: string, reason: "done" | "error" | "abort") => {
      const snapshot = conversationRef.current;

      setConversation((prev) => {
        // Finalize if no terminal event already did (e.g. abort).
        if (prev.activeId !== finishedId) return prev;
        return {
          ...prev,
          activeId: null,
          status: "idle",
          messages: prev.messages.map((m) =>
            m.id === finishedId
              ? { ...m, status: reason === "abort" ? "stopped" : "complete" }
              : m,
          ),
        };
      });

      // Drain the queue: start the next pending generation, if any.
      const { next: queuedMessage, queue } = dequeue(snapshot.queue);
      if (queuedMessage == null) {
        if (snapshot.queue.length > 0) {
          setConversation((prev) => ({ ...prev, queue }));
        }
        return;
      }

      // The dequeued turn now becomes a real message; `snapshot.messages` holds only
      // already-dispatched turns, so history is exactly those + this one — later still-
      // queued turns never leak into it. Attachments ride only on this dispatched turn
      // (T071, bounded payload growth per send).
      const user = makeUser(queuedMessage.text, queuedMessage.attachments);
      const assistant = makeAssistant();
      const history: ChatRequestMessage[] = [
        ...snapshot.messages.map((m) => ({
          role: m.role,
          content: flattenText(m),
        })),
        {
          role: "user" as const,
          content: queuedMessage.text,
          ...(queuedMessage.attachments.length > 0
            ? { attachments: queuedMessage.attachments }
            : {}),
        },
      ];
      setConversation((prev) => ({
        ...prev,
        queue,
        messages: [...prev.messages, user, assistant],
        activeId: assistant.id,
        status: "streaming",
      }));
      beginGenerationRef.current(assistant.id, history);
    },
    [makeUser, makeAssistant],
  );

  const beginGeneration = useCallback(
    (assistantId: string, history: ChatRequestMessage[]) => {
      try {
        controllerRef.current = transport.send(
          {
            messages: history,
            conversationId: conversationRef.current.id,
            agentId: agentIdRef.current ?? undefined,
          },
          {
            onEvent: (event) => {
              // Surface the *detailed* stream failure (server `detail`/`error` message,
              // or the browser's network error) in a persistent toast — the inline
              // notice only says "network error", never why. `autoClose: false` keeps it
              // up until the user dismisses it.
              if (event.type === "error") {
                toast.error(event.message, { autoClose: false });
              }
              setConversation((prev) => reduceStreamEvent(prev, event));
            },
            onClose: (reason) => handleClose(assistantId, reason),
          },
        );
      } catch (err) {
        const message = readableError(err);
        setConfigError(message);
        setConversation((prev) => ({
          ...prev,
          activeId: null,
          status: "idle",
          messages: prev.messages.map((m) =>
            m.id === assistantId
              ? { ...m, status: "error", error: message }
              : m,
          ),
        }));
      }
    },
    [transport, handleClose],
  );

  // Keep the indirection ref pointing at the latest beginGeneration so the
  // queue-drain path in handleClose always dispatches the current closure.
  useEffect(() => {
    beginGenerationRef.current = beginGeneration;
  }, [beginGeneration]);

  const cancel = useCallback(() => {
    // Aborting the active controller makes the transport fire onClose("abort"),
    // which routes through handleClose: partial parts stay, status → stopped, and
    // any queued message dispatches next. Idempotent — aborting an already-aborted
    // or absent controller is a no-op. Also aborts an active replay (US2, FR-013).
    controllerRef.current?.abort();
    replayHandleRef.current?.abort();
  }, []);

  const newConversation = useCallback(() => {
    controllerRef.current?.abort();
    // A fresh, empty session with a new id. We don't persist it (an empty conversation
    // isn't saved) and we leave every other saved conversation untouched — the prior
    // one was already persisted on its terminal transition.
    setConversation({
      id: generateId(),
      messages: [],
      activeId: null,
      queue: [],
      status: "idle",
    });
  }, [generateId]);

  const selectConversation = useCallback(
    (id: string) => {
      if (id === conversationRef.current.id) return; // already open
      controllerRef.current?.abort();
      void history.load(id).then((restored) => {
        if (restored) setConversation(restored);
      });
    },
    [history],
  );

  const submitFeedback = useCallback(
    (feedback: Feedback): Promise<void> => {
      // Optimistic single-choice selection; a rejected submit keeps it (the panel
      // surfaces a non-blocking notice) — feedback is never a blocking gate (D10).
      setConversation((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === feedback.messageId
            ? {
                ...m,
                feedback: {
                  rating: feedback.rating,
                  // Keep any prior comment when this submit is rating-only (the panel
                  // sends the rating first, then the comment as a second call).
                  comment: feedback.comment ?? m.feedback?.comment,
                  submittedAt: Date.now(),
                },
              }
            : m,
        ),
      }));
      return feedbackSink.submit(feedback);
    },
    [feedbackSink],
  );

  const send = useCallback(
    (text: string, attachments: Attachment[] = []) => {
      // FR-002 — no empty bubble/request. Attachments ride along with typed text; they
      // don't stand alone (kept simple — T071 doesn't add an image-only send path).
      if (isBlank(text)) return;
      const snapshot = conversationRef.current;

      if (snapshot.status === "streaming") {
        // Queue behind the active generation; auto-dispatched on terminal. The pending
        // bubble is derived from `queue` (dimmed, "queued") — the queued turn is NOT put
        // into `messages`, which holds only turns already dispatched to the backend.
        setConversation((prev) => ({
          ...prev,
          queue: enqueue(prev.queue, generateId(), text, attachments),
        }));
        return;
      }

      const user = makeUser(text, attachments);
      const assistant = makeAssistant();
      const history: ChatRequestMessage[] = [
        ...snapshot.messages.map((m) => ({
          role: m.role,
          content: flattenText(m),
        })),
        {
          role: "user" as const,
          content: text,
          ...(attachments.length > 0 ? { attachments } : {}),
        },
      ];
      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, user, assistant],
        activeId: assistant.id,
        status: "streaming",
      }));
      beginGeneration(assistant.id, history);
    },
    [makeUser, makeAssistant, beginGeneration, generateId],
  );

  // --- Replay actions (feature 002). Replay drives the SAME conversation state through
  // the SAME reducer + terminal handler (handleClose) as live streaming, so tool
  // timelines / reasoning / markdown render identically (FR-012). ---

  const toggleReplayMode = useCallback(() => {
    // Abort whatever is streaming (live or replay) and reset to a fresh in-memory
    // conversation. Save stays suppressed (replayModeRef), so nothing resurrects (D-R4).
    controllerRef.current?.abort();
    replayHandleRef.current?.abort();
    replayHandleRef.current = null;

    const next = !replayModeRef.current;
    replayModeRef.current = next; // sync so the persistence effect reads the new value
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
  }, [generateId]);

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
  }, [replaySession, makeUser, makeAssistant, handleClose]);

  // Render view: real messages followed by the still-queued turns as pending ("queued")
  // bubbles. `queue` stays out of `conversation.messages` (which persists / feeds the
  // backend history), so this derivation is the only place the two rejoin — for display.
  const renderMessages = useMemo(
    () => [
      ...conversation.messages,
      ...conversation.queue.map(
        (q): Message => ({
          id: q.id,
          role: "user",
          parts: [{ type: "text", text: q.text }],
          attachments: q.attachments,
          status: "queued",
          error: null,
          feedback: null,
          createdAt: 0,
        }),
      ),
    ],
    [conversation.messages, conversation.queue],
  );

  return {
    conversation,
    messages: renderMessages,
    status: conversation.status,
    configError,
    conversations,
    send,
    cancel,
    newConversation,
    selectConversation,
    submitFeedback,
    replayMode,
    toggleReplayMode,
    replaySession,
    replayPlay,
    replayPause,
    replaySetSource,
    replaySetTiming,
    replayResetTiming,
    replaySetSpeed,
  };
}
