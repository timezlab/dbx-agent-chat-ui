import * as React from "react";
import { ArrowRightIcon, MessageCircleQuestionIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FollowUpSuggestionsProps extends Omit<React.ComponentProps<"div">, "onSelect"> {
  items: string[];
  onSelectPrompt?: (text: string) => void;
}

/**
 * Follow-up questions offered below a settled answer. A hairline separates them from the
 * reply, under a small "Related questions" label; each is a borderless row (leading arrow +
 * text) split by thin dividers, lighting up on hover with a nudging arrow. Rendered by
 * Streamdown's `<suggested-followups>` custom-tag component (the block stays inline in the
 * reply text) — see assistant-message.tsx.
 */
export function FollowUpSuggestions({
  items,
  onSelectPrompt,
  className,
  ...props
}: FollowUpSuggestionsProps) {
  if (!items || items.length === 0) return null;

  return (
    <div
      data-slot="follow-up-suggestions"
      className={cn("mt-5 border-t border-border pt-3", className)}
      {...props}
    >
      <div className="mb-1 flex items-center gap-1.5 pl-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MessageCircleQuestionIcon className="size-3.5 text-primary" />
        Related questions
      </div>
      <div className="flex flex-col">
        {items.map((item, idx) => (
          <button
            key={idx}
            type="button"
            data-slot="follow-up-item"
            onClick={() => onSelectPrompt?.(item)}
            className={cn(
              "group/fu relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-muted-foreground transition-colors",
              // Inset hairline between rows (never touches the rounded corners); the row's own
              // divider fades out while it's hovered so the highlight reads as one clean block.
              "before:pointer-events-none before:absolute before:inset-x-1 before:-top-px before:h-px before:bg-border/60 before:transition-opacity first:before:hidden",
              "hover:bg-muted/50 hover:text-foreground hover:before:opacity-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
          >
            <ArrowRightIcon className="mt-px size-3.5 shrink-0 text-muted-foreground/70 transition-[transform,color] group-hover/fu:translate-x-0.5 group-hover/fu:text-primary" />
            <span className="min-w-0 flex-1 leading-snug">{item}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
