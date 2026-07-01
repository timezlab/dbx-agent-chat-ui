"use client";

import * as React from "react";

import type { Agent, CapabilityConfig } from "@/entities";
import { useChat, type UseChatResult } from "@/hooks/chat/use-chat";
import { useAgents } from "@/hooks/agents/use-agents";

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
  const { agents, selectedId, setSelectedId, available } = useAgents({
    config: config ?? {},
  });
  const chat = useChat({ config, agentId: selectedId });

  const value: ChatContextValue = {
    ...chat,
    agents,
    selectedAgentId: selectedId,
    selectAgent: setSelectedId,
    agentsAvailable: available,
    samplePrompts: config?.samplePrompts ?? [],
    uploadEnabled: config?.uploadEnabled ?? false,
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
