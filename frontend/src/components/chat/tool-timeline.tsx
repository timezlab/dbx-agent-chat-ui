"use client";

import * as React from "react";
import { CheckIcon, ChevronRightIcon, GlobeIcon } from "lucide-react";
import { z } from "zod";

import {
  type ToolActivityItem,
  type Todo,
  type WebSearchResult,
  TodoSchema,
  webSearchResultsSchema,
} from "@/entities";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { isKnownTool, toolDisplay } from "./tool-meta";

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
 * The expanded body for a tool call. Built-in tools get a humanized view; the plan
 * renders as a checklist; unknown/custom tools keep their raw args JSON untouched.
 * Returns null when there is nothing worth expanding.
 */
function toolBody(item: ToolActivityItem): React.ReactNode {
  const args = (item.args ?? {}) as Record<string, unknown>;

  // The plan: render the todos as a status checklist (its args ARE the content).
  if (item.name === "write_todos") {
    const parsed = TodosArraySchema.safeParse(args.todos);
    if (!parsed.success || parsed.data.length === 0) return null;
    return <PlanList todos={parsed.data} />;
  }

  // Web search: its output is an array of source objects (url + preview), not a blob —
  // render them as source cards. Non-array payloads fall through to the generic view.
  if (item.name === "web_search") {
    const sources = parseWebSearchResults(item.detail);
    if (sources.length > 0) return <SourceList sources={sources} />;
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

/** Compact key/value list for scalar / short-string args. */
function ArgList({ entries }: { entries: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([key, value]) => (
        <React.Fragment key={key}>
          <dt className="font-mono text-muted-foreground">{key}</dt>
          <dd className="min-w-0 font-mono wrap-break-word text-foreground/80">
            {value}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/** A labeled, scrollable block for long text — file contents, command output, etc. */
function LabeledBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-56 overflow-auto rounded border border-border bg-background px-2 py-1.5 font-mono text-[11px] leading-tight whitespace-pre-wrap wrap-break-word">
        {text}
      </pre>
    </div>
  );
}

/** Parse a `web_search` output blob into typed sources; `[]` if it isn't a result array. */
function parseWebSearchResults(detail: string | null): WebSearchResult[] {
  if (!detail) return [];
  let json: unknown;
  try {
    json = JSON.parse(detail);
  } catch {
    return [];
  }
  const parsed = webSearchResultsSchema.safeParse(json);
  return parsed.success ? parsed.data : [];
}

/** Host of a URL for display / favicon lookup; the raw string if it won't parse. */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Google's favicon service, keyed by host. Null when the URL is unparseable. */
function faviconSrc(url: string): string | null {
  try {
    return `https://www.google.com/s2/favicons?sz=128&domain=${new URL(url).hostname}`;
  } catch {
    return null;
  }
}

/**
 * web_search results as source cards. Row 1: favicon + title (left) + domain (right).
 * Row 2: the preview snippet (clamped to two lines).
 */
function SourceList({ sources }: { sources: WebSearchResult[] }) {
  return (
    <ul className="flex flex-col gap-2 py-0.5">
      {sources.map((s, i) => (
        <li key={i}>
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card px-2.5 py-2 transition-colors hover:border-border"
          >
            {/* Row 1: logo · title · domain */}
            <span className="flex items-center gap-2">
              <SourceFavicon url={s.url} />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                {s.title || hostnameOf(s.url)}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground/70">
                {hostnameOf(s.url)}
              </span>
            </span>
            {/* Row 2: preview */}
            {s.preview ? (
              <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground mt-1">
                {s.preview}
              </span>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Favicon for a source; falls back to a neutral globe if it can't load. */
function SourceFavicon({ url }: { url: string }) {
  const src = faviconSrc(url);
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center">
        <GlobeIcon className="size-3.5 text-muted-foreground" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external favicon, not a bundled asset
    <img
      src={src}
      alt=""
      role="presentation"
      width={16}
      height={16}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-4 shrink-0 rounded-sm"
    />
  );
}

/** The plan at this point in the timeline, as a status checklist. */
function PlanList({ todos }: { todos: Todo[] }) {
  return (
    <ol className="flex flex-col gap-1 py-0.5">
      {todos.map((todo, i) => (
        <li
          key={i}
          data-status={todo.status}
          className="flex items-start gap-2 text-xs leading-snug"
        >
          <PlanDot status={todo.status} />
          <span
            className={cn(
              "min-w-0 flex-1",
              todo.status === "completed" &&
                "text-muted-foreground line-through",
              todo.status === "in_progress" && "font-medium text-foreground",
              todo.status === "pending" && "text-muted-foreground",
            )}
          >
            {todo.content}
          </span>
        </li>
      ))}
    </ol>
  );
}

function PlanDot({ status }: { status: Todo["status"] }) {
  if (status === "completed") {
    return (
      <span className="mt-px flex size-3.5 shrink-0 items-center justify-center rounded-full bg-good/15 text-good">
        <CheckIcon className="size-2.5" />
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="mt-px flex size-3.5 shrink-0 items-center justify-center">
        <span className="size-2 animate-pulse rounded-full bg-running" />
      </span>
    );
  }
  return (
    <span className="mt-px flex size-3.5 shrink-0 items-center justify-center">
      <span className="size-2 rounded-full border border-muted-foreground/50" />
    </span>
  );
}

export default ToolTimeline;
