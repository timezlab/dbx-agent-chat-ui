import * as React from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FollowUpSuggestionsProps extends Omit<React.ComponentProps<"div">, "onSelect"> {
  items: string[];
  onSelectPrompt?: (text: string) => void;
}

export function FollowUpSuggestions({
  items,
  onSelectPrompt,
  className,
  ...props
}: FollowUpSuggestionsProps) {
  if (!items || items.length === 0) return null;

  return (
    <div
      className={cn("flex flex-col items-start gap-2 mt-4", className)}
      {...props}
    >
      {items.map((item, idx) => (
        <Button
          key={idx}
          variant="outline"
          className="rounded-xl border border-border/60 bg-transparent hover:bg-muted/50 whitespace-normal text-left h-auto py-2 px-3.5 text-[13px] text-muted-foreground hover:text-foreground transition-all flex items-start gap-2"
          onClick={() => onSelectPrompt?.(item)}
        >
          <span className="leading-snug">{item}</span>
          <ArrowUpRightIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-50" />
        </Button>
      ))}
    </div>
  );
}
