"use client";

import * as React from "react";
import { TriangleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { firstTodoWriteCallId, selectLatestTodos } from "@/lib/chat/todos";
import { useChatContext } from "./chat-provider";
import { MessageList } from "./message-list";
import { ChatComposer } from "./chat-composer";
import { ChatEmpty } from "./chat-empty";

export type ChatScreenProps = React.ComponentProps<"div">;

/**
 * The chat surface: the message timeline (or an empty-state greeting) + the composer,
 * driven by the shared `useChat` via `useChatContext`. When no chat endpoint is
 * configured (or the transport fails to start) a clear, non-crashing inline notice is
 * shown instead of failing silently (T055, spec Edge Cases). The composer carries the
 * agent's live todo plan (docked on the input card).
 */
export function ChatScreen({ className, ...props }: ChatScreenProps) {
  const {
    messages,
    status,
    configError,
    send,
    cancel,
    submitFeedback,
    agents,
    selectedAgentId,
    selectAgent,
    agentsAvailable,
    samplePrompts,
    uploadEnabled,
    uploadAccept,
    uploadMaxSizeBytes,
  } = useChatContext();
  const todos = selectLatestTodos(messages);
  const firstPlanCallId = firstTodoWriteCallId(messages);
  const empty = messages.length === 0;

  return (
    <div
      data-slot="chat-screen"
      className={cn(
        "flex h-full min-h-0 w-full flex-col bg-background text-foreground",
        className,
      )}
      {...props}
    >
      {configError ? (
        <div
          role="alert"
          data-slot="chat-config-notice"
          className="mx-auto mt-4 flex w-full max-w-3xl items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>{configError}</span>
        </div>
      ) : null}

      {empty ? (
        // The empty-state slot owns the scroll (mirrors the MessageList slot): it fills
        // the space and scrolls when the viewport is short; `my-auto` on ChatEmpty
        // centers the content when it fits, and collapses so the top stays reachable
        // when it overflows.
        <div
          data-slot="chat-empty-scroll"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <ChatEmpty
            samplePrompts={samplePrompts}
            onSelectPrompt={send}
            disabled={configError != null}
            className="my-auto"
          />
        </div>
      ) : (
        <MessageList
          messages={messages}
          onFeedback={submitFeedback}
          firstPlanCallId={firstPlanCallId}
          className="min-h-0 flex-1"
        />
      )}

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <ChatComposer
          onSend={send}
          onCancel={cancel}
          todos={todos}
          busy={status === "streaming"}
          disabled={configError != null}
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={selectAgent}
          agentsAvailable={agentsAvailable}
          uploadEnabled={uploadEnabled}
          uploadAccept={uploadAccept}
          uploadMaxSizeBytes={uploadMaxSizeBytes}
        />
      </div>
    </div>
  );
}

export default ChatScreen;
