import { CheckIcon } from "lucide-react";

import type { Todo } from "@/entities";
import { cn } from "@/lib/utils";

type DotSize = "sm" | "md";

/**
 * Shared plan/todo rendering used in two places: the composer plan card (`TodoCard`,
 * `md` + animated) and the tool-timeline plan step (`PlanList`, `sm`). Keeps the
 * three-state dot semantics and per-status text styling in ONE place.
 */

/** Per-item text styling by status: strike done, emphasize active, mute pending. */
function todoTextClass(status: Todo["status"]): string {
  return cn(
    "min-w-0 flex-1",
    status === "completed" && "text-muted-foreground line-through",
    status === "in_progress" && "font-medium text-foreground",
    status === "pending" && "text-muted-foreground",
  );
}

/** Three-state status indicator (completed ✓ · in-progress pulse · pending ring). */
export function StatusDot({
  status,
  size = "md",
}: {
  status: Todo["status"];
  size?: DotSize;
}) {
  const outer = size === "md" ? "size-4" : "size-3.5";
  const inner = size === "md" ? "size-2.5" : "size-2";
  const mt = size === "md" ? "mt-0.5" : "mt-px";

  if (status === "completed") {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-good/15 text-good",
          outer,
          mt,
        )}
      >
        <CheckIcon className={size === "md" ? "size-3" : "size-2.5"} />
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className={cn("flex shrink-0 items-center justify-center", outer, mt)}>
        <span className={cn("animate-pulse rounded-full bg-running", inner)} />
      </span>
    );
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center", outer, mt)}>
      <span
        className={cn("rounded-full border border-muted-foreground/50", inner)}
      />
    </span>
  );
}

/** The plan as a status checklist. `md` for the composer card, `sm` for the timeline. */
export function TodoChecklist({
  todos,
  size = "md",
  animate = false,
  className,
}: {
  todos: Todo[];
  size?: DotSize;
  animate?: boolean;
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "flex flex-col",
        size === "md" ? "gap-1.5" : "gap-1",
        className,
      )}
    >
      {todos.map((todo, i) => (
        <li
          key={i}
          data-status={todo.status}
          className={cn(
            "flex items-start leading-snug",
            size === "md" ? "gap-2.5" : "gap-2 text-xs",
            animate && "animate-in fade-in slide-in-from-top-1 fill-mode-both",
          )}
          style={animate ? { animationDelay: `${i * 40}ms` } : undefined}
        >
          <StatusDot status={todo.status} size={size} />
          <span className={todoTextClass(todo.status)}>{todo.content}</span>
        </li>
      ))}
    </ol>
  );
}

export default TodoChecklist;
