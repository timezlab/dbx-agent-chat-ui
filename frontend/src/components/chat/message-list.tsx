"use client";

import * as React from "react";

import type { Feedback, Message } from "@/entities";
import { cn } from "@/lib/utils";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";

export interface MessageListProps extends React.ComponentProps<"div"> {
  messages: Message[];
  /** Submit feedback for an assistant reply; omitted ⇒ feedback panel hidden. */
  onFeedback?: (feedback: Feedback) => void | Promise<void>;
  /** Call id of the conversation's first `write_todos` (→ "Create plan"). */
  firstPlanCallId?: string | null;
}

/**
 * Renders the conversation timeline with sticky-bottom autoscroll (the scroller
 * follows new tokens while pinned to the end, and stops following once the user
 * scrolls up). Each turn renders as a user or assistant message.
 */
export function MessageList({
  messages,
  onFeedback,
  firstPlanCallId,
  className,
  ...props
}: MessageListProps) {
  const lastId = messages.length ? messages[messages.length - 1].id : null;

  return (
    // `autoScroll` arms the sticky-bottom follow: while pinned to the end the scroller
    // keeps chasing new tokens, and it releases the moment the user scrolls up. Without
    // it the primitive never follows a stream (it defaults to off).
    // `scrollEdgeThreshold` = how close to the bottom still counts as "pinned". The
    // primitive default (8px) is far too tight for a streaming chat — a user reading a
    // few lines up (~250px) would lose the follow. Widen it so streaming stays glued
    // unless the user scrolls well up.
    <MessageScrollerProvider autoScroll scrollEdgeThreshold={350}>
      <MessageScroller
        data-slot="message-list"
        className={cn("flex-1", className)}
        {...props}
      >
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-6">
            {messages.map((message) => (
              <MessageScrollerItem
                key={message.id}
                scrollAnchor={message.id === lastId}
              >
                {message.role === "user" ? (
                  <UserMessage message={message} />
                ) : (
                  <AssistantMessage
                    message={message}
                    onFeedback={onFeedback}
                    firstPlanCallId={firstPlanCallId}
                  />
                )}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

export default MessageList;
