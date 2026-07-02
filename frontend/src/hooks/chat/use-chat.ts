"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  Attachment,
  CapabilityConfig,
  ChatRequestMessage,
  Conversation,
  Message,
} from "@/entities";
import { resolveConfig, isChatEndpointMissing } from "@/lib/config";
import { dequeue, enqueue, isBlank } from "@/lib/chat/queue";
import { reduceStreamEvent } from "@/lib/chat/reducer";
import { createChatTransport, type ChatTransport } from "@/lib/chat/transport";
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

export interface UseChatResult {
  conversation: Conversation;
  messages: Message[];
  status: "idle" | "streaming";
  /** Readable inline notice when the chat endpoint is missing/unavailable (T055). */
  configError: string | null;
  send: (text: string, attachments?: Attachment[]) => void;
  /** Abort the active generation; partial output is kept and marked `stopped` (US2). */
  cancel: () => void;
  /** Start a fresh conversation and replace persisted state (no stale resurrection, US4). */
  newConversation: () => void;
  /** Submit feedback for a reply; optimistically reflects the selection (US3). */
  submitFeedback: (feedback: Feedback) => Promise<void>;
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
    void history.load().then((restored) => {
      if (cancelled || !restored) return;
      setConversation((prev) =>
        prev.messages.length === 0 && prev.status === "idle" && !prev.activeId
          ? restored
          : prev,
      );
    });
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
      conversation.messages.length > 0
    ) {
      void history.save(conversation);
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
            onEvent: (event) =>
              setConversation((prev) => reduceStreamEvent(prev, event)),
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
    // or absent controller is a no-op.
    controllerRef.current?.abort();
  }, []);

  const newConversation = useCallback(() => {
    controllerRef.current?.abort();
    const fresh: Conversation = {
      id: generateId(),
      messages: [],
      activeId: null,
      queue: [],
      status: "idle",
    };
    setConversation(fresh);
    // Replace persisted state so a reload doesn't resurrect the old conversation.
    void history.save(fresh);
  }, [generateId, history]);

  const submitFeedback = useCallback(
    (feedback: Feedback): Promise<void> => {
      // Optimistic single-choice selection; a rejected submit keeps it (the panel
      // surfaces a non-blocking notice) — feedback is never a blocking gate (D10).
      setConversation((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === feedback.messageId ? { ...m, feedback: feedback.rating } : m,
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
    send,
    cancel,
    newConversation,
    submitFeedback,
  };
}
