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
} from "@/components/ui/message-scroller";
import { MessageViewport } from "./message-viewport";
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
  return (
    // `autoScroll` arms the sticky-bottom follow: while pinned to the end the scroller
    // keeps chasing new tokens, and it releases the moment the user scrolls up. Without
    // it the primitive never follows a stream (it defaults to off).
    // `scrollEdgeThreshold` = how close to the bottom still counts as "pinned". The
    // primitive default (8px) is far too tight for a streaming chat — a user reading a
    // few lines up (~250px) would lose the follow. Widen it so streaming stays glued
    // unless the user scrolls well up.
    //
    // NO `scrollAnchor` on items: marking the latest turn as an anchor makes the primitive
    // pin it near the TOP and reserve a dynamic hidden spacer below it — which, when a turn
    // shrinks (a tool-call group collapses), GROWS the empty space to keep the anchor pinned,
    // leaving a phantom-tall height until you scroll. Classic bottom-anchored chat instead:
    // the timeline height always tracks content, so a collapse shrinks it immediately.
    <MessageScrollerProvider autoScroll scrollEdgeThreshold={350}>
      <MessageScroller
        data-slot="message-list"
        className={cn("flex-1", className)}
        {...props}
      >
        <MessageViewport>
          <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-6">
            {messages.map((message) => (
              <MessageScrollerItem key={message.id}>
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
        </MessageViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

export default MessageList;
