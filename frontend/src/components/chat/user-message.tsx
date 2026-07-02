import * as React from "react";
import { PaperclipIcon, UserIcon } from "lucide-react";

import type { Message } from "@/entities";
import { cn } from "@/lib/utils";
import {
  Message as MessageRow,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
        {message.attachments.length > 0 ? (
          <div
            data-slot="user-message-attachments"
            className="mt-1 flex w-fit max-w-[85%] flex-wrap justify-end gap-1.5 self-end"
          >
            {message.attachments.map((a) => (
              <span
                key={a.id}
                data-slot="user-message-attachment"
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              >
                <PaperclipIcon className="size-3" />
                <span className="max-w-40 truncate">{a.name}</span>
                <span className="text-muted-foreground/70">{formatBytes(a.size)}</span>
              </span>
            ))}
          </div>
        ) : null}
      </MessageContent>
    </MessageRow>
  );
}

export default UserMessage;
