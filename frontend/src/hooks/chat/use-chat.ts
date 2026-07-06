"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import type {
  Attachment,
  CapabilityConfig,
  ChatRequestMessage,
  ChatSession,
  Conversation,
  Message,
} from "@/entities";
import { toChatSession } from "@/entities";
import { resolveConfig, isChatEndpointMissing } from "@/lib/config";
import { dequeue, enqueue, isBlank } from "@/lib/chat/queue";
import { reduceStreamEvent } from "@/lib/chat/reducer";
import { createChatTransport, type ChatTransport } from "@/lib/chat/transport";
import { HistoryApiService } from "@/lib/api/history";
import { FeedbackApiService } from "@/lib/api/feedback";
import { useSessionStore } from "@/store/session-store";
import {
  useReplay,
  type ReplaySession,
  type ReplaySource,
  type ReplaySpeed,
} from "./use-replay";
import type { Feedback } from "@/entities";

// Replay types live in `use-replay`; re-exported here so existing consumers keep their
// `@/hooks/chat/use-chat` import path.
export type { ReplaySession, ReplaySource, ReplaySpeed };

export interface UseChatOptions {
  /** Public capability config; defaults to `resolveConfig()` (env-derived). */
  config?: CapabilityConfig;
  /** Transport port; defaults to `createChatTransport(config.chatEndpointUrl)`. Injectable for tests. */
  transport?: ChatTransport;
  /** Injected clock for `createdAt` (keeps pure code free of `Date.now()`). */
  now?: () => number;
  /** Injected id generator (stable, unique). */
  generateId?: () => string;
  /**
   * Load a full conversation by id; defaults to `new HistoryApiService(config).load`.
   * Injectable for tests. Used on startup (re-open the stored conversation) and when
   * selecting a past conversation.
   */
  loadHistory?: (id: string) => Promise<Conversation | null>;
  /**
   * Submit feedback; defaults to `new FeedbackApiService(config).submit`. Injectable for
   * tests.
   */
  submitFeedback?: (feedback: Feedback) => Promise<void>;
  /**
   * Called on each terminal turn (streaming → idle with content, non-replay) so the shell
   * can reconcile the sidebar list (optimistic prepend + invalidate). No-op by default.
   */
  onConversationSettled?: (conversation: Conversation) => void;
  /**
   * Selected agent id (US5). Rides along on every `ChatRequest.agentId`; null/undefined
   * ⇒ no agent id (default endpoint routing, FR-025/FR-026).
   */
  agentId?: string | null;
}

export interface UseChatResult {
  conversation: Conversation;
  messages: Message[];
  status: "idle" | "streaming";
  /**
   * True while a selected/restored conversation's turns are being fetched from the backend
   * (from `selectConversation`, or the startup re-open). The surface switches to the target
   * conversation immediately and shows a loading skeleton until the turns land — it does not
   * keep the previous conversation on screen while the fetch is in flight.
   */
  loadingConversation: boolean;
  /** Readable inline notice when the chat endpoint is missing/unavailable (T055). */
  configError: string | null;
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

  const loadHistory = useMemo(
    () =>
      options.loadHistory ??
      ((id: string) => new HistoryApiService(config).load(id)),
    [options.loadHistory, config],
  );

  const submitFeedbackFn = useMemo(
    () =>
      options.submitFeedback ??
      ((feedback: Feedback) => new FeedbackApiService(config).submit(feedback)),
    [options.submitFeedback, config],
  );

  const onConversationSettled = options.onConversationSettled;

  // Publish the active conversation id to the session store (persisted pointer). The
  // reducer stays the single writer of the `conversation` object; the store only mirrors
  // the id so a reload can re-open it.
  const setConversationId = useSessionStore((s) => s.setConversationId);
  const newConversationId = useSessionStore((s) => s.newConversationId);
  // Startup must wait for the persisted pointer to be read back (post-mount rehydrate),
  // otherwise it reads the default `null` and shows an empty screen despite a stored id.
  const hasHydrated = useSessionStore((s) => s._hasHydrated);

  // Runtime session = a persisted `Conversation` (id + messages) plus the streaming
  // state machine's transient fields (activeId/queue/status). `loadHistory` returns the
  // base `Conversation`; it is hydrated into a session via `toChatSession` on open.
  const [conversation, setConversation] = useState<ChatSession>(() => ({
    id: generateId(),
    messages: [],
    activeId: null,
    queue: [],
    status: "idle",
  }));

  // True while a conversation's turns are loading from the backend (select or startup
  // re-open). Only one load is "current" at a time — `activeLoadRef` holds the id being
  // loaded so a superseded fetch (rapid re-select) neither applies its turns nor clears the
  // flag out from under the newer load.
  const [loadingConversation, setLoadingConversation] = useState(false);
  const activeLoadRef = useRef<string | null>(null);

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

  // Startup: re-open the conversation the store points at (persisted pointer). Nothing
  // opened yet (id null, e.g. a first-ever visit) ⇒ an empty screen — we do NOT
  // auto-open "the most recent". Only hydrate a still-pristine session so we never
  // clobber a chat the user already started while the async load was in flight.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!hasHydrated) return; // wait for persisted pointer; effect re-runs when it flips
    if (loadedRef.current) return;
    loadedRef.current = true;
    const storedId = useSessionStore.getState().conversationId;
    if (!storedId) return; // nothing opened before ⇒ empty
    let cancelled = false;
    // Show the loading skeleton until the restored turns land (instead of flashing the
    // empty-state greeting while the fetch is in flight). `activeLoadRef` also lets a user
    // action that supersedes this startup load (e.g. picking another conversation) bail out.
    activeLoadRef.current = storedId;
    // Starting the async restore — reflect its pending state so the surface shows the
    // skeleton, not the empty greeting. (One-time load kick-off, not a render-loop.)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingConversation(true);
    void loadHistory(storedId)
      .then((restored) => {
        if (cancelled || !restored || activeLoadRef.current !== storedId) return;
        setConversation((prev) =>
          prev.messages.length === 0 && prev.status === "idle" && !prev.activeId
            ? toChatSession(restored)
            : prev,
        );
      })
      .catch(() => {
        // Swallow: a missing/failed load ⇒ stay on the empty session (no local fallback).
      })
      .finally(() => {
        if (!cancelled && activeLoadRef.current === storedId)
          setLoadingConversation(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadHistory, hasHydrated]);

  // Selected agent id, read imperatively at send time so a mid-session change of agent
  // takes effect on the next request without re-creating the transport callbacks.
  const agentIdRef = useRef<string | null>(options.agentId ?? null);
  useEffect(() => {
    agentIdRef.current = options.agentId ?? null;
  });

  const controllerRef = useRef<AbortController | null>(null);
  // Aborting the active controller fires `onClose("abort")` SYNCHRONOUSLY (see streamSSE),
  // which routes through `handleClose` and drains the queue. That is what we want for
  // `cancel()` (the queued turn dispatches next), but NOT when we abort as part of LEAVING
  // the conversation (`newConversation` / `selectConversation`): there the queued turn must
  // be discarded, not sent to the backend. This flag, set only around a teardown abort,
  // tells `handleClose` to skip the drain for that one abort.
  const suppressQueueDrainRef = useRef(false);
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

      // Leaving the conversation (newConversation/selectConversation) aborts mid-stream
      // only to tear down — the caller replaces the whole conversation next, so the queued
      // turn must be dropped, not dispatched. Skip the drain for that one abort.
      if (suppressQueueDrainRef.current) return;

      // Drain the queue: start the next pending generation, if any (empty ⇒ nothing to do).
      const { next: queuedMessage, queue } = dequeue(snapshot.queue);
      if (queuedMessage == null) return;

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

  // Dev-tools Replay (feature 002) lives in its own hook; it drives the SAME conversation
  // state through the SAME reducer + `handleClose` as live streaming.
  const {
    isReplayActive,
    abortReplay,
    ...replay
  } = useReplay({
    setConversation,
    makeUser,
    makeAssistant,
    handleClose,
    generateId,
    abortActiveGeneration: () => controllerRef.current?.abort(),
  });

  // On each terminal turn transition (streaming → idle with content, non-replay), publish
  // the id to the store (persisted pointer) and let the shell reconcile the sidebar list
  // (optimistic prepend + invalidate). The backend records the turns as they stream —
  // there is no client-side `save`.
  const prevStatusRef = useRef(conversation.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = conversation.status;
    if (
      prev === "streaming" &&
      conversation.status === "idle" &&
      conversation.messages.length > 0 &&
      // Replay turns never touch history (FR-020 / SC-006) — client-only, non-resurrecting.
      !isReplayActive()
    ) {
      setConversationId(conversation.id);
      onConversationSettled?.(conversation);
    }
  }, [conversation, onConversationSettled, setConversationId, isReplayActive]);

  const cancel = useCallback(() => {
    // Aborting the active controller makes the transport fire onClose("abort"),
    // which routes through handleClose: partial parts stay, status → stopped, and
    // any queued message dispatches next. Idempotent — aborting an already-aborted
    // or absent controller is a no-op. Also aborts an active replay (US2, FR-013).
    controllerRef.current?.abort();
    abortReplay();
  }, [abortReplay]);

  const newConversation = useCallback(() => {
    // Teardown abort: suppress the synchronous queue-drain so a turn queued behind the
    // active generation is discarded with the conversation, not sent to the backend. The
    // flag is consumed inside abort() (handleClose runs synchronously); clear it after in
    // case there was no active generation to abort.
    suppressQueueDrainRef.current = true;
    controllerRef.current?.abort();
    suppressQueueDrainRef.current = false;
    // A fresh, empty session with a new id, minted through the store so the persisted
    // pointer follows the current session. Nothing is saved (empty), and every settled
    // conversation stays recorded by the backend.
    const id = newConversationId();
    // Cancel any in-flight restore so its late turns can't land on the new blank session.
    activeLoadRef.current = null;
    setLoadingConversation(false);
    setConversation({
      id,
      messages: [],
      activeId: null,
      queue: [],
      status: "idle",
    });
  }, [newConversationId]);

  const selectConversation = useCallback(
    (id: string) => {
      if (id === conversationRef.current.id) return; // already open
      // Teardown abort (see newConversation): a turn queued behind the active generation is
      // discarded when leaving, not dispatched to the backend.
      suppressQueueDrainRef.current = true;
      controllerRef.current?.abort();
      suppressQueueDrainRef.current = false;
      // Publish the pointer eagerly so a reload re-opens this one even if the fetch is
      // still in flight; the backend is the source of the turns.
      setConversationId(id);
      // Switch immediately: swap in a blank target session (id set now, so the sidebar
      // highlight and any reload point here at once) and show the skeleton — don't keep the
      // previous conversation's turns on screen while the fetch is in flight. `activeLoadRef`
      // guards against a rapid re-select applying a stale/superseded fetch.
      activeLoadRef.current = id;
      setConversation({ id, messages: [], activeId: null, queue: [], status: "idle" });
      setLoadingConversation(true);
      void loadHistory(id)
        .then((restored) => {
          if (activeLoadRef.current !== id || !restored) return;
          setConversation(toChatSession(restored));
        })
        .finally(() => {
          if (activeLoadRef.current === id) setLoadingConversation(false);
        });
    },
    [loadHistory, setConversationId],
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
      return submitFeedbackFn(feedback);
    },
    [submitFeedbackFn],
  );

  const send = useCallback(
    (text: string, attachments: Attachment[] = []) => {
      // FR-002 — no empty bubble/request. Attachments ride along with typed text; they
      // don't stand alone (kept simple — T071 doesn't add an image-only send path).
      if (isBlank(text)) return;
      const snapshot = conversationRef.current;

      // Sending in the current session supersedes any in-flight restore of it — cancel the
      // load so its late turns can't overwrite this just-sent turn, and drop the skeleton.
      activeLoadRef.current = null;
      setLoadingConversation(false);

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
    loadingConversation,
    configError,
    send,
    cancel,
    newConversation,
    selectConversation,
    submitFeedback,
    // Replay public API (replayMode, replaySession, replayPlay/Pause/SetSource/…).
    ...replay,
  };
}
