"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder timeline shown while a selected / restored conversation's turns are fetched
 * from the backend (see `useChat.loadingConversation`). Mirrors the `MessageList` container
 * — same centered `max-w-3xl` column and padding — so the real turns land without a layout
 * jump. A few alternating user (right) / assistant (left) bubbles read as "a chat is
 * loading" rather than an empty screen.
 */
export function MessageListSkeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-list-skeleton"
      aria-hidden
      className={cn("min-h-0 flex-1 overflow-hidden", className)}
      {...props}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            {/* User turn — a short right-aligned bubble. */}
            <div className="flex justify-end">
              <Skeleton className="h-9 w-2/5 rounded-2xl" />
            </div>
            {/* Assistant turn — a few left-aligned lines of varying width. */}
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MessageListSkeleton;
