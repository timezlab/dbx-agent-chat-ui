"use client";

import * as React from "react";
import { PencilIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";

import type { Feedback, FeedbackRating } from "@/entities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface FeedbackPanelProps
  extends Omit<React.ComponentProps<"div">, "onSubmit"> {
  messageId: string;
  /** Current saved selection (single choice), typically `message.feedback?.rating`. */
  value?: FeedbackRating | null;
  /** Previously-saved comment (`message.feedback?.comment`) to seed the form / show. */
  comment?: string;
  /**
   * Preset quick-reasons offered as selectable chips, per rating. Selecting chips (plus the
   * optional "Other" free-text) composes the comment. Defaults to `DEFAULT_REASONS`.
   */
  reasons?: Record<FeedbackRating, string[]>;
  /** Submit to the resolved sink. Rejection is non-blocking; the form stays open. */
  onSubmit: (feedback: Feedback) => void | Promise<void>;
}

/**
 * Built-in quick-reason chips, tailored to the rating and to an AI data-platform agent
 * (SQL/query correctness, data accuracy, table & source grounding) rather than generic chat.
 */
export const DEFAULT_REASONS: Record<FeedbackRating, string[]> = {
  up: [
    "Accurate results",
    "Correct SQL / query",
    "Clear explanation",
    "Useful insight",
    "Right tables & sources",
  ],
  down: [
    "Incorrect results",
    "Wrong SQL / query",
    "Hallucinated data",
    "Wrong tables or columns",
    "Missing context",
    "Didn't answer the question",
  ],
};

/** Compose the free-text comment from the chosen chips + the "Other" text. */
function composeComment(reasons: string[], other: string): string | undefined {
  const extra = other.trim();
  if (reasons.length && extra) return `${reasons.join(", ")} — ${extra}`;
  if (reasons.length) return reasons.join(", ");
  return extra || undefined;
}

/** A selectable pill (quick-reason / "Other"). Toggles on click. */
function ReasonChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Thumbs up/down + an optional quick-reason/comment for an assistant reply (FR-010, D10).
 *
 * Interaction (redesigned): clicking a thumb only SELECTS the rating (it colors in) and
 * opens the form — nothing is sent yet. The submission is fired ONCE, on the explicit
 * "Submit" button, whether or not a comment was added. A settled/restored submission shows
 * a compact confirmation with the comment; "Edit" re-opens the form. Single choice — the
 * thumb reflects the current rating; a rejected submit is non-blocking and keeps the form.
 */
export function FeedbackPanel({
  messageId,
  value = null,
  comment: savedComment,
  reasons = DEFAULT_REASONS,
  onSubmit,
  className,
  ...props
}: FeedbackPanelProps) {
  // "idle" → thumbs only; "editing" → thumbs + form; "submitted" → thumbs + confirmation.
  const [phase, setPhase] = React.useState<"idle" | "editing" | "submitted">(
    value != null ? "submitted" : "idle",
  );
  const [rating, setRating] = React.useState<FeedbackRating | null>(value);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [otherOpen, setOtherOpen] = React.useState(false);
  const [other, setOther] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Enter the form for a rating (from idle, from a submitted card, or switching thumbs).
  // Switching to a different rating clears chip picks (they're rating-specific), but keeps
  // any typed "Other" text.
  const openEditor = (next: FeedbackRating) => {
    setError(null);
    if (next !== rating) setPicked(new Set());
    // Re-opening a restored/submitted feedback seeds the free-text with the saved comment.
    if (phase === "submitted" && savedComment && other === "") {
      setOther(savedComment);
      setOtherOpen(true);
    }
    setRating(next);
    setPhase("editing");
  };

  const toggleReason = (reason: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(reason)) next.delete(reason);
      else next.add(reason);
      return next;
    });
  };

  const cancel = () => {
    setError(null);
    setPicked(new Set());
    setOther("");
    setOtherOpen(false);
    // Fall back to the confirmation if a submission already exists, else the bare thumbs.
    if (value != null) {
      setRating(value);
      setPhase("submitted");
    } else {
      setRating(null);
      setPhase("idle");
    }
  };

  const submit = () => {
    if (rating == null) return;
    setError(null);
    setPending(true);
    const composed = composeComment([...picked], other);
    Promise.resolve(
      onSubmit({
        messageId,
        rating,
        ...(composed ? { comment: composed } : {}),
      }),
    )
      .then(() => {
        setPhase("submitted");
      })
      .catch(() => setError("Couldn't save feedback — please try again."))
      .finally(() => setPending(false));
  };

  const thumb = (r: FeedbackRating) => {
    const active = rating === r;
    const Icon = r === "up" ? ThumbsUpIcon : ThumbsDownIcon;
    return (
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-pressed={active}
        aria-label={r === "up" ? "Good response" : "Bad response"}
        onClick={() => openEditor(r)}
        className={cn(
          active
            ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            : "text-muted-foreground",
        )}
      >
        <Icon />
      </Button>
    );
  };

  const activeReasons = rating ? (reasons[rating] ?? []) : [];

  return (
    <div
      data-slot="feedback-panel"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      <div className="flex items-center gap-1">
        {thumb("up")}
        {thumb("down")}
      </div>

      {phase === "editing" && rating ? (
        <div
          data-slot="feedback-form"
          className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3 animate-in fade-in-0 slide-in-from-top-1 duration-200"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {rating === "up"
              ? "What did you like? (optional)"
              : "What went wrong? (optional)"}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {activeReasons.map((reason) => (
              <ReasonChip
                key={reason}
                active={picked.has(reason)}
                onClick={() => toggleReason(reason)}
              >
                {reason}
              </ReasonChip>
            ))}
            <ReasonChip
              active={otherOpen}
              onClick={() => setOtherOpen((v) => !v)}
            >
              Other…
            </ReasonChip>
          </div>

          {otherOpen ? (
            <Textarea
              data-slot="feedback-comment"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="Add a comment"
              rows={2}
              autoFocus
              aria-label="Feedback comment"
              className="min-h-16 resize-none text-sm"
            />
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={pending}
            >
              {pending ? "Submitting…" : "Submit"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={cancel}
              disabled={pending}
            >
              Cancel
            </Button>
            {error ? (
              <span role="status" className="text-xs text-destructive">
                {error}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === "submitted" ? (
        <div
          data-slot="feedback-submitted"
          className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2 animate-in fade-in-0 duration-200"
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground">
              Thanks for your feedback
            </span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => rating && openEditor(rating)}
              className="ml-auto text-muted-foreground"
            >
              <PencilIcon />
              Edit
            </Button>
          </div>
          {savedComment ? (
            <p className="border-l-2 border-border pl-2.5 text-sm whitespace-pre-wrap text-muted-foreground">
              {savedComment}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default FeedbackPanel;
