"use client";

import * as React from "react";

import type { Agent, CapabilityConfig, Conversation } from "@/entities";
import { useChat, type UseChatResult } from "@/hooks/chat/use-chat";
import { useAgents } from "@/hooks/agents/use-agents";
import { useHistoryMutations } from "@/hooks/chat/use-history";
import { summarizeConversation } from "@/lib/api/history";
import { DEFAULT_CONTEXT_WINDOW } from "@/lib/config";
import { useSessionStore } from "@/store/session-store";

/**
 * The shared chat state plus the runtime agent selection (US5) and the presentational
 * config the chat surface needs (sample prompts, upload toggle). One object so the
 * screen, composer, and empty-state read from a single source.
 */
export interface ChatContextValue extends UseChatResult {
  /** Selectable agents (empty ⇒ selector hidden). */
  agents: Agent[];
  /** Selected agent id, sent on each request. Null ⇒ default routing. */
  selectedAgentId: string | null;
  /** Choose an agent. */
  selectAgent: (id: string) => void;
  /** Whether to render the agent selector (agents configured + non-empty). */
  agentsAvailable: boolean;
  /** Empty-state sample prompts (from public config). */
  samplePrompts: string[];
  /** Whether the composer's attach/upload affordance is enabled. */
  uploadEnabled: boolean;
  /** File-picker accept list for the composer (T071). */
  uploadAccept?: string;
  /** Max size per attached file, in bytes (T071). */
  uploadMaxSizeBytes?: number;
  /** Whether the developer/test Dev tools + Replay affordances are enabled (FR-026). */
  devToolsEnabled: boolean;
  /** Whether the per-reply usage/metrics footer + per-tool run-time are shown (default on). */
  usageEnabled: boolean;
  /** Context-window size (tokens) the meter measures occupancy against when the backend
   *  reports no per-turn `context_window` (004). */
  contextWindow: number;
}

const ChatContext = React.createContext<ChatContextValue | null>(null);

export interface ChatProviderProps {
  /** Public capability config; defaults to env-derived `resolveConfig()`. */
  config?: CapabilityConfig;
  children: React.ReactNode;
}

/**
 * Owns the single `useChat` instance for the app and shares it via context so the
 * chat surface and the shell (sidebar "New chat", active-conversation label) act on
 * ONE conversation state — no duplicated transports, no divergent state. The agent
 * selection (fetched from the agents API when configured) lives here too so the chosen
 * `agentId` rides along on every request.
 */
export function ChatProvider({ config, children }: ChatProviderProps) {
  // Seed the store config once when an explicit config prop is given (embedding / docs
  // demo); the env path already holds the right default.
  const setConfig = useSessionStore((s) => s.setConfig);
  React.useEffect(() => {
    if (config) setConfig(config);
  }, [config, setConfig]);

  const { agents, selectedId, setSelectedId, available } = useAgents({
    config: config ?? {},
  });

  // On a settled turn, reconcile the sidebar list: optimistically prepend the summary,
  // then invalidate so the backend's ordering wins.
  const { prependConversation, invalidate } = useHistoryMutations();
  const onConversationSettled = React.useCallback(
    (conversation: Conversation) => {
      prependConversation(summarizeConversation(conversation));
      invalidate();
    },
    [prependConversation, invalidate],
  );

  const chat = useChat({ config, agentId: selectedId, onConversationSettled });

  const value: ChatContextValue = {
    ...chat,
    agents,
    selectedAgentId: selectedId,
    selectAgent: setSelectedId,
    agentsAvailable: available,
    samplePrompts: config?.samplePrompts ?? [],
    uploadEnabled: config?.uploadEnabled ?? false,
    uploadAccept: config?.uploadAccept,
    uploadMaxSizeBytes: config?.uploadMaxSizeBytes,
    devToolsEnabled: config?.devToolsEnabled ?? false,
    usageEnabled: config?.usageEnabled ?? true,
    contextWindow: config?.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

/** Read the shared chat state. Must be called under a `<ChatProvider>`. */
export function useChatContext(): ChatContextValue {
  const ctx = React.useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext must be used within <ChatProvider>");
  }
  return ctx;
}

export default ChatProvider;
