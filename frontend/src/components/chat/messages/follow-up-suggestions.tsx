import * as React from "react";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

export interface FollowUpSuggestionsProps extends Omit<
  React.ComponentProps<"div">,
  "onSelect"
> {
  items: string[];
  onSelectPrompt?: (text: string) => void;
}

/**
 * Follow-up questions offered below a settled answer, under a small "Related questions"
 * label badged with the app logo; each is a borderless row (leading arrow + text) split by
 * thin dividers, lighting up on hover with a nudging arrow. Rendered by Streamdown's
 * `<suggested-followups>` custom-tag component (the block stays inline in the reply text) —
 * see assistant-message.tsx.
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
      className={cn("mt-6", className)}
      {...props}
    >
      <div className="mb-1 flex items-center gap-1.5 pl-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Logo className="size-6" />
        Related questions
      </div>
      {/* divide-y draws a border-top between rows (every child but the first). The divider
          belongs to the row, so it stays put under the hover highlight instead of vanishing. */}
      <div className="flex flex-col divide-y divide-border/60">
        {items.map((item, idx) => (
          <button
            key={idx}
            type="button"
            data-slot="follow-up-item"
            onClick={() => onSelectPrompt?.(item)}
            className={cn(
              "group/fu flex w-full cursor-pointer items-center gap-2.5 px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors",
              "hover:bg-muted/50 hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
          >
            <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground/70 transition-[transform,color] group-hover/fu:translate-x-0.5 group-hover/fu:text-primary" />
            {/* Text eases its colour AND nudges right alongside the arrow on hover, so the whole
                row shifts as one. */}
            <span className="min-w-0 flex-1 leading-6 transition-[color,transform] group-hover/fu:translate-x-0.5">
              {item}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
