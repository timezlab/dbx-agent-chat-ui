"use client";

import * as React from "react";
import { CheckIcon, ChevronRightIcon, ListChecksIcon } from "lucide-react";

import type { Todo } from "@/entities";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface TodoCardProps extends React.ComponentProps<"div"> {
  todos: Todo[];
}

/**
 * The agent's current plan, rendered ON the composer (chimai aesthetic): a
 * collapsed summary strip with an `n/m done` progress bar the user can expand into
 * a status checklist (completed / in-progress-pulse / pending). Sourced from the
 * newest `write_todos` list (see `lib/chat/todos.ts`). Renders nothing when empty.
 */
export function TodoCard({ todos, className, ...props }: TodoCardProps) {
  const total = todos.length;
  const done = React.useMemo(
    () => todos.filter((t) => t.status === "completed").length,
    [todos],
  );

  if (total === 0) return null;

  const pct = Math.round((done / total) * 100);

  return (
    <Collapsible
      data-slot="todo-card"
      className={cn(
        "rounded-lg border border-border bg-muted/40 text-sm",
        className,
      )}
      {...props}
    >
      <CollapsibleTrigger className="group/todo flex w-full items-center gap-2 px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <ListChecksIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-medium">Plan</span>
        <span
          className="ml-auto shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
          aria-label={`${done} of ${total} tasks done`}
        >
          {done}/{total}
        </span>
        <span
          className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/todo:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="flex flex-col gap-1.5 border-t border-border px-3 py-2.5">
          {todos.map((todo, i) => (
            <li
              key={i}
              data-status={todo.status}
              className="flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 fill-mode-both"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <StatusDot status={todo.status} />
              <span
                className={cn(
                  "min-w-0 flex-1 leading-snug",
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
      </CollapsibleContent>
    </Collapsible>
  );
}

function StatusDot({ status }: { status: Todo["status"] }) {
  if (status === "completed") {
    return (
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-good/15 text-good">
        <CheckIcon className="size-3" />
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
        <span className="size-2.5 animate-pulse rounded-full bg-running" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
      <span className="size-2.5 rounded-full border border-muted-foreground/50" />
    </span>
  );
}

export default TodoCard;
