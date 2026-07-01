"use client";

import * as React from "react";
import { ArrowUpRightIcon, MessageSquareTextIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

export interface ChatEmptyProps extends React.ComponentProps<"div"> {
  /** Suggested prompts (from public config); empty ⇒ just the greeting. */
  samplePrompts?: string[];
  /** Send a chosen sample prompt straight into the conversation. */
  onSelectPrompt?: (prompt: string) => void;
  /** Disable the sample cards (e.g. no chat endpoint configured). */
  disabled?: boolean;
}

/**
 * The pre-conversation surface: a centered greeting plus — when sample prompts are
 * configured (`NEXT_PUBLIC_SAMPLE_PROMPTS`) — a grid of starter cards. Each card is a
 * default-icon + prompt button that sends the prompt on click, so a new user has a
 * concrete way in. With no samples it degrades to the plain greeting.
 */
export function ChatEmpty({
  samplePrompts = [],
  onSelectPrompt,
  disabled = false,
  className,
  ...props
}: ChatEmptyProps) {
  const hasSamples = samplePrompts.length > 0;

  return (
    <div
      data-slot="chat-empty"
      className={cn(
        "mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col items-center gap-3">
        <Logo className="size-24 drop-shadow-sm" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">How can I help?</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Ask the agent anything. Answers stream live, with tool activity and its
            plan shown as it works.
          </p>
        </div>
      </div>

      {hasSamples ? (
        <div
          data-slot="chat-empty-samples"
          className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {samplePrompts.map((prompt, i) => (
            <button
              key={`${i}-${prompt}`}
              type="button"
              data-slot="chat-empty-sample"
              disabled={disabled}
              onClick={() => onSelectPrompt?.(prompt)}
              className={cn(
                "group/sample flex w-full cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left text-sm shadow-sm transition-colors",
                "hover:border-ring/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-card",
              )}
            >
              <MessageSquareTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover/sample:text-foreground" />
              <span className="min-w-0 flex-1 text-foreground/90">{prompt}</span>
              <ArrowUpRightIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover/sample:translate-x-0.5 group-hover/sample:-translate-y-0.5 group-hover/sample:text-foreground" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ChatEmpty;
