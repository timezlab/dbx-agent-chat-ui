"use client";

import * as React from "react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { BrainIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";

import type { ActivityPart } from "@/lib/chat/message-parts";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToolTimeline } from "./tool-timeline";
import { toolDisplay } from "./tool-meta";

export interface ActivityGroupProps {
  /** The consecutive reasoning/tools run this group folds (see groupMessageParts). */
  parts: ActivityPart[];
  /**
   * True while this group is the streaming tail — it stays open and live, then
   * auto-collapses the moment the turn moves on (answer text starts, or stream ends).
   */
  active: boolean;
  /** Call id of the conversation's first `write_todos` (→ "Create plan"). */
  firstPlanCallId?: string | null;
}

interface Headline {
  icon: ComponentType<LucideProps>;
  title: string;
  subtitle: string | null;
  mono: boolean;
}

/**
 * The header summarizes the group's LAST step (its current action while streaming),
 * so a folded process reads like "Search TOI|NII" / "Read SKILL.md" / "Thinking…"
 * rather than a generic label.
 */
function headline(
  parts: ActivityPart[],
  active: boolean,
  firstPlanCallId?: string | null,
): Headline {
  const last = parts[parts.length - 1];
  if (last?.type === "tools" && last.items.length > 0) {
    const item = last.items[last.items.length - 1];
    const d = toolDisplay(item, { firstPlan: item.id === firstPlanCallId });
    return { icon: d.icon, title: d.title, subtitle: d.subtitle, mono: d.mono };
  }
  return {
    icon: BrainIcon,
    title: active ? "Thinking…" : "Thought process",
    subtitle: null,
    mono: false,
  };
}

/**
 * Folds a run of reasoning + tool activity into ONE collapsible "process" dropdown
 * (claude.ai-style) so a long tool run doesn't stretch the transcript. Open + live
 * while it is the streaming tail (`active`); auto-collapses when the turn moves on,
 * but stays user-toggleable afterwards. Reasoning renders inline as muted italic
 * text; tools render as the flat, individually-expandable tool timeline.
 */
export function ActivityGroup({
  parts,
  active,
  firstPlanCallId,
}: ActivityGroupProps) {
  const [open, setOpen] = React.useState(active);
  const wasActive = React.useRef(active);
  // Follow the streaming state (open when it becomes the tail, collapse when done)
  // without clobbering a manual toggle on a settled group.
  React.useEffect(() => {
    if (wasActive.current !== active) {
      setOpen(active);
      wasActive.current = active;
    }
  }, [active]);

  const { icon: Icon, title, subtitle, mono } = headline(
    parts,
    active,
    firstPlanCallId,
  );
  const lastIndex = parts.length - 1;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-slot="activity-group"
      data-active={active}
      className="group/activity animate-in fade-in-0 slide-in-from-bottom-1 text-sm duration-300"
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 text-left text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
        <Icon className="size-3.5 shrink-0" />
        {/* Key the title/subtitle by their text so a changing step (e.g. the process
            moves from "Search …" to "Read …") remounts and fades in, rather than
            snapping to the new label mid-stream. */}
        <span key={title} className="shrink-0 animate-in fade-in-0 duration-200">
          {title}
        </span>
        {subtitle ? (
          <span
            key={subtitle}
            className={cn(
              "min-w-0 truncate font-normal animate-in fade-in-0 duration-200",
              mono && "font-mono",
            )}
          >
            {subtitle}
          </span>
        ) : null}
        {active ? (
          <Loader2Icon className="size-3 shrink-0 animate-spin text-muted-foreground/70" />
        ) : null}
        <ChevronRightIcon className="size-3.5 shrink-0 transition-transform group-data-[state=open]/activity:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 ml-1.5 flex flex-col gap-2 border-l border-border pl-3">
        {parts.map((part, i) =>
          part.type === "reasoning" ? (
            <ReasoningText
              key={i}
              text={part.text}
              streaming={active && i === lastIndex}
            />
          ) : (
            <ToolTimeline
              key={i}
              items={part.items}
              firstPlanCallId={firstPlanCallId}
            />
          ),
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Reasoning text inline inside a group (the group is the collapse, so no nesting). */
function ReasoningText({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  return (
    <p
      className={cn(
        "animate-in fade-in-0 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground/80 italic duration-300",
        streaming &&
          "after:ml-0.5 after:inline-block after:h-3.5 after:w-1 after:animate-pulse after:bg-muted-foreground after:align-middle after:content-['']",
      )}
    >
      {text}
    </p>
  );
}

export default ActivityGroup;
