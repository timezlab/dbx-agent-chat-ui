"use client";

import * as React from "react";
import { GaugeIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatTokens, type ContextUsage } from "@/lib/chat/metrics";

export interface ContextMeterProps extends React.ComponentProps<"div"> {
  /** Meter reading from `resolveContextUsage`. */
  usage: ContextUsage;
}

/** Per-level foreground color; `normal` stays muted so the meter is ambient until it matters. */
const LEVEL_CLASS: Record<Exclude<ContextUsage["level"], "unknown">, string> = {
  normal: "text-muted-foreground/80",
  warn: "text-amber-600 dark:text-amber-500",
  danger: "text-red-600 dark:text-red-500",
};

/**
 * Compact context-window meter for the composer toolbar (004): `used / limit · pct%` of the
 * backend Checkpoint, tinting amber at ≥70% and red at ≥90%. Purely presentational — it reads
 * a resolved `ContextUsage` and renders nothing when the level is `"unknown"` (no measurable
 * turn yet). Gating on the usage flag + placement is the caller's job.
 */
export function ContextMeter({ usage, className, ...props }: ContextMeterProps) {
  if (usage.level === "unknown") return null;

  return (
    <div
      data-slot="context-meter"
      data-level={usage.level}
      role="group"
      aria-label={`Context window ${usage.pct}% used`}
      title={`Context: ${usage.used.toLocaleString("en-US")} / ${usage.limit.toLocaleString("en-US")} tokens (${usage.pct}%)`}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-xs tabular-nums",
        LEVEL_CLASS[usage.level],
        className,
      )}
      {...props}
    >
      <GaugeIcon className="size-3 shrink-0" aria-hidden />
      {formatTokens(usage.used)} / {formatTokens(usage.limit)} · {usage.pct}%
    </div>
  );
}

export default ContextMeter;
