"use client";

import { cn } from "@/lib/utils";
import {
  COMPACT_MIN_TOKENS,
  contextPct,
  type ContextUsage,
} from "@/lib/chat/metrics";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ContextMeterProps {
  /** Meter reading from `resolveContextUsage`. */
  usage: ContextUsage;
  /** Run manual `/compact`. When provided AND occupancy ≥ threshold, the ring is clickable. */
  onCompact?: () => void;
  /** A generation is in flight — the compact click is disabled while busy. */
  busy?: boolean;
  className?: string;
}

/** Ring progress color per level; `normal` stays muted so it is ambient until it matters. */
const LEVEL_CLASS: Record<Exclude<ContextUsage["level"], "unknown">, string> = {
  normal: "text-muted-foreground",
  warn: "text-amber-500",
  danger: "text-red-500",
};

const SIZE = 16;
const STROKE = 2;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/**
 * Context-window meter as a circular ring whose arc fills with occupancy of the backend
 * Checkpoint (004): muted → amber at ≥70% → red at ≥90%. The ring doubles as the manual
 * `/compact` control — once occupancy passes `COMPACT_MIN_TOKENS` it becomes a button that
 * runs compaction (disabled while a generation streams). Below the threshold, or with no
 * compact handler, it is a non-interactive gauge. Renders nothing when occupancy is
 * unmeasurable (`level === "unknown"`).
 */
export function ContextMeter({
  usage,
  onCompact,
  busy = false,
  className,
}: ContextMeterProps) {
  if (usage.level === "unknown") return null;

  const pct = contextPct(usage);
  const dashoffset = CIRC * (1 - pct / 100);
  const compactable = onCompact != null && usage.used >= COMPACT_MIN_TOKENS;

  const detail = `Context: ${usage.used.toLocaleString("en-US")} / ${usage.limit.toLocaleString("en-US")} tokens (${pct}%)`;

  const ring = (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={cn("shrink-0", LEVEL_CLASS[usage.level])}
      aria-hidden
    >
      {/* Track */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        strokeWidth={STROKE}
        className="stroke-muted-foreground/20"
      />
      {/* Progress arc — starts at 12 o'clock, fills clockwise by pct. */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={dashoffset}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
    </svg>
  );

  const base = "inline-flex items-center justify-center rounded-full";

  const content = compactable ? (
    <button
      type="button"
      data-slot="context-meter"
      data-level={usage.level}
      disabled={busy}
      onClick={onCompact}
      aria-label={`Compact context (${pct}% used)`}
      className={cn(
        base,
        "transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {ring}
    </button>
  ) : (
    <span
      role="img"
      data-slot="context-meter"
      data-level={usage.level}
      aria-label={`${pct}% context used`}
      className={cn(base, className)}
    >
      {ring}
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>
          {compactable ? `Compact context (/compact) — ${detail}` : detail}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ContextMeter;
