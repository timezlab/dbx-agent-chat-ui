import * as React from "react";
import { UserIcon } from "lucide-react";

import type { Message } from "@/entities";
import { cn } from "@/lib/utils";
import {
  Message as MessageRow,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";

/** Join a message's text parts (user turns are a single text part). */
function textOf(message: Message): string {
  return message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

export interface UserMessageProps extends React.ComponentProps<"div"> {
  message: Message;
}

/**
 * A user turn: an end-aligned indigo-accent bubble with the typed text (FR-002,
 * plain text). No avatar — the right alignment + accent fill already signal "you".
 */
export function UserMessage({ message, className, ...props }: UserMessageProps) {
  return (
    <MessageRow
      align="end"
      data-slot="user-message"
      data-status={message.status}
      // A queued turn (still waiting its turn to send) reads as pending: dimmed, then
      // fading back to full opacity once it leaves the queue.
      className={cn(
        "transition-opacity duration-300",
        message.status === "queued" && "opacity-50",
        className,
      )}
      {...props}
    >
      <MessageAvatar className="size-7 self-start bg-primary text-primary-foreground">
        <UserIcon className="size-4" />
      </MessageAvatar>
      <MessageContent>
        <div
          data-slot="user-bubble"
          className="w-fit max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2 text-sm leading-relaxed text-primary-foreground whitespace-pre-wrap"
        >
          {textOf(message)}
        </div>
      </MessageContent>
    </MessageRow>
  );
}

export default UserMessage;
