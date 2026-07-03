import type { Todo } from "@/entities";
import { TodoChecklist } from "../todo-checklist";

/** `write_todos` output: the plan as an inline (`sm`) status checklist. */
export function PlanList({ todos }: { todos: Todo[] }) {
  return <TodoChecklist todos={todos} size="sm" />;
}
