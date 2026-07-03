"use client";

import * as React from "react";
import { ChevronRightIcon, ListChecksIcon } from "lucide-react";

import type { Todo } from "@/entities";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TodoChecklist } from "./todo-checklist";

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
        <TodoChecklist
          todos={todos}
          size="md"
          animate
          className="border-t border-border px-3 py-2.5"
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

export default TodoCard;
