import * as React from "react";
import { TriangleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StreamErrorProps extends React.ComponentProps<"div"> {
  message: string;
}

/**
 * Inline stream-error notice shown on an assistant turn that errored (FR-009). Partial
 * output stays above it; the turn remains usable. Self-contained and non-crashing.
 */
export function StreamError({ message, className, ...props }: StreamErrorProps) {
  return (
    <div
      role="alert"
      data-slot="stream-error"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive",
        className,
      )}
      {...props}
    >
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default StreamError;
