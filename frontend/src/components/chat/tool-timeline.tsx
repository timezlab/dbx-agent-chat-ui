"use client";

import * as React from "react";
import { ChevronRightIcon } from "lucide-react";
import { z } from "zod";

import { type ToolActivityItem, TodoSchema } from "@/entities";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/chat/metrics";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { isKnownTool, toolDisplay } from "./tool-meta";
import {
  ArgList,
  LabeledBlock,
  PlanList,
  SourceList,
  parseWebSearchResults,
  SqlTable,
  parseSqlResult,
  RetrievalList,
  parseRetrievalResults,
} from "./tool-output";

const TodosArraySchema = z.array(TodoSchema);

/** A string arg longer than this renders as its own scrollable block, not a chip. */
const LONG_ARG = 120;

export interface ToolTimelineProps extends React.ComponentProps<"div"> {
  items: ToolActivityItem[];
  /** Call id of the conversation's first `write_todos` (→ "Create plan"). */
  firstPlanCallId?: string | null;
}

/**
 * Renders one `tools` part — a run of consecutive tool calls — as a flat list of
 * rows that sit at the SAME level as text and reasoning (no wrapping card/tint, so
 * the timeline reads as one column, not nested boxes — issue 7). Each row expands to
 * a tool-aware body (issue 5): the plan as a checklist, built-in tools as friendly
 * args + output, and unknown/custom tools as their raw args payload. Tool icons stay
 * neutral; the locked indigo accent is reserved for `running`, `good` for done.
 */
export function ToolTimeline({
  items,
  firstPlanCallId,
  className,
  ...props
}: ToolTimelineProps) {
  if (items.length === 0) return null;

  return (
    <div
      data-slot="tool-timeline"
      className={cn("flex flex-col gap-2 text-sm", className)}
      {...props}
    >
      {items.map((item) => (
        <ToolRow
          key={item.id}
          item={item}
          firstPlan={item.id === firstPlanCallId}
        />
      ))}
    </div>
  );
}

function ToolRow({
  item,
  firstPlan,
}: {
  item: ToolActivityItem;
  firstPlan: boolean;
}) {
  const {
    icon: Icon,
    title,
    subtitle,
    mono,
  } = toolDisplay(item, { firstPlan });
  const body = toolBody(item);
  const expandable = body != null;

  return (
    <Collapsible
      data-slot="tool-activity-item"
      data-status={item.status}
      className="group/tool animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
    >
      <CollapsibleTrigger
        className="flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 text-left text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:text-muted-foreground"
        disabled={!expandable}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="shrink-0">{title}</span>
        {subtitle ? (
          <span
            className={cn("min-w-0 truncate font-normal", mono && "font-mono")}
          >
            {subtitle}
          </span>
        ) : null}
        {item.durationMs != null ? (
          // Per-tool run time, when the backend reports it (optional). Sits at the row end,
          // muted, so a settled tool reads "grep · content · 1.2s".
          <span
            data-slot="tool-duration"
            className="ml-auto shrink-0 pl-2 font-normal tabular-nums text-muted-foreground/70"
          >
            {formatDuration(item.durationMs)}
          </span>
        ) : null}
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform group-data-[state=open]/tool:rotate-90",
            !expandable && "invisible",
          )}
        />
      </CollapsibleTrigger>
      {expandable ? (
        <CollapsibleContent className="ml-6 mt-1 mb-1 border-border">
          {body}
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

/**
 * The expanded body for a tool call. Built-in tools get a humanized view; structured
 * outputs (plan, web search, SQL, retrieval) render in their own `tool-output/` module;
 * unknown/custom tools keep their raw args JSON. Returns null when nothing is worth
 * expanding.
 */
function toolBody(item: ToolActivityItem): React.ReactNode {
  const args = (item.args ?? {}) as Record<string, unknown>;

  // The plan: render the todos as a status checklist (its args ARE the content).
  if (item.name === "write_todos") {
    const parsed = TodosArraySchema.safeParse(args.todos);
    if (!parsed.success || parsed.data.length === 0) return null;
    return <PlanList todos={parsed.data} />;
  }

  // Web search: output is an array of source objects (url + preview) → source cards.
  // Non-array payloads fall through to the generic view.
  if (item.name === "web_search") {
    const sources = parseWebSearchResults(item.detail);
    if (sources.length > 0) return <SourceList sources={sources} />;
  }

  // SQL query: output is a `{ columns, rows }` table → render as a table card.
  if (item.name === "execute_sql") {
    const table = parseSqlResult(item.detail);
    if (table) return <SqlTable table={table} />;
  }

  // Vector search: output is an array of retrieval chunks → render as chunk cards.
  if (item.name === "vector_search") {
    const chunks = parseRetrievalResults(item.detail);
    if (chunks.length > 0) return <RetrievalList chunks={chunks} />;
  }

  // Built-in tools: short args as a compact list, long text + output as blocks.
  if (isKnownTool(item.name)) {
    const short: [string, string][] = [];
    const long: [string, string][] = [];
    for (const [key, value] of Object.entries(args)) {
      if (value == null) continue;
      if (typeof value === "string") {
        (value.length > LONG_ARG ? long : short).push([key, value]);
      } else if (typeof value === "object") {
        long.push([key, JSON.stringify(value, null, 2)]);
      } else {
        short.push([key, String(value)]);
      }
    }
    const hasOutput = typeof item.detail === "string" && item.detail.length > 0;
    if (short.length === 0 && long.length === 0 && !hasOutput) return null;
    return (
      <div className="space-y-2 py-0.5">
        {short.length > 0 ? <ArgList entries={short} /> : null}
        {long.map(([key, value]) => (
          <LabeledBlock key={key} label={key} text={value} />
        ))}
        {hasOutput ? <LabeledBlock label="output" text={item.detail!} /> : null}
      </div>
    );
  }

  // Unknown / custom tools: keep the raw args payload, AND show the tool's output
  // (issue 3 — custom tools like create_chart/save_report DO return output; it rides
  // `detail` from the paired function_call_output, but was previously never expanded).
  const hasArgs = Object.keys(args).length > 0;
  const customOutput =
    typeof item.detail === "string" && item.detail.length > 0;
  if (!hasArgs && !customOutput) return null;
  return (
    <div className="space-y-2 py-0.5">
      {hasArgs ? (
        <LabeledBlock label="args" text={JSON.stringify(item.args, null, 2)} />
      ) : null}
      {customOutput ? (
        <LabeledBlock label="output" text={item.detail!} />
      ) : null}
    </div>
  );
}

export default ToolTimeline;
