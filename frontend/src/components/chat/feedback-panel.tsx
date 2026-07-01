"use client";

import * as React from "react";
import { SendIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";

import type { Feedback, FeedbackRating } from "@/entities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface FeedbackPanelProps
  extends Omit<React.ComponentProps<"div">, "onSubmit"> {
  messageId: string;
  /** Current selection (single choice), typically `message.feedback`. */
  value?: FeedbackRating | null;
  /** Submit to the resolved sink. Rejection is non-blocking; the selection is kept. */
  onSubmit: (feedback: Feedback) => void | Promise<void>;
}

/**
 * Thumbs up/down + an optional comment for an assistant reply (FR-010, D10). Single
 * choice — picking a rating replaces the previous one and submits optimistically. A
 * rejected submit shows a non-blocking notice and retains the selection.
 */
export function FeedbackPanel({
  messageId,
  value = null,
  onSubmit,
  className,
  ...props
}: FeedbackPanelProps) {
  const [comment, setComment] = React.useState("");
  const [showComment, setShowComment] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = (rating: FeedbackRating, withComment?: string) => {
    setError(null);
    Promise.resolve(
      onSubmit({
        messageId,
        rating,
        ...(withComment ? { comment: withComment } : {}),
      }),
    ).catch(() => setError("Couldn't save feedback — please try again."));
  };

  const rate = (rating: FeedbackRating) => {
    submit(rating);
    setShowComment(true);
  };

  return (
    <div
      data-slot="feedback-panel"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant={value === "up" ? "secondary" : "ghost"}
          aria-pressed={value === "up"}
          aria-label="Good response"
          onClick={() => rate("up")}
        >
          <ThumbsUpIcon />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={value === "down" ? "secondary" : "ghost"}
          aria-pressed={value === "down"}
          aria-label="Bad response"
          onClick={() => rate("down")}
        >
          <ThumbsDownIcon />
        </Button>
      </div>

      {showComment && value ? (
        <div className="flex items-end gap-2">
          <Textarea
            data-slot="feedback-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment (optional)"
            rows={1}
            aria-label="Feedback comment"
            className="min-h-9 flex-1 resize-none text-sm"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Send comment"
            disabled={comment.trim() === ""}
            onClick={() => {
              submit(value, comment.trim());
              setComment("");
            }}
          >
            <SendIcon />
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="status" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default FeedbackPanel;
