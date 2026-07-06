"use client";

import * as React from "react";
import { ClockIcon, ZapIcon } from "lucide-react";
import { FaMoneyBillWave } from "react-icons/fa";
import { TbCoin } from "react-icons/tb";

import type { Message } from "@/entities";
import { cn } from "@/lib/utils";
import {
  formatCost,
  formatDuration,
  formatTokens,
  hasVisibleContent,
  resolveTotalTokens,
} from "@/lib/chat/metrics";

export interface MessageMetricsProps extends React.ComponentProps<"div"> {
  message: Message;
  /** Whether this turn is still streaming — drives the live (ticking) total clock. */
  streaming: boolean;
  /** Injectable monotonic clock (ms) for tests; defaults to `performance.now()`. */
  now?: () => number;
}

const defaultNow = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

/**
 * The per-reply usage/metrics footer under a settled assistant turn (and a live clock while
 * it streams): total time · time-to-first-token · tokens · cost.
 *
 * TIME and TTFT are measured CLIENT-side during a live turn (a realtime clock that ticks
 * while streaming, then freezes) — no backend needed. TOKENS and COST are backend-provided
 * (`message.metrics`, from the `usage` frame). A RELOADED conversation never streamed here,
 * so it shows only whatever the backend persisted in `metrics` (incl. `durationMs`/`ttftMs`
 * if sent). Renders nothing when there is neither a live clock nor any metric to show.
 */
export function MessageMetrics({
  message,
  streaming,
  now = defaultNow,
  className,
  ...props
}: MessageMetricsProps) {
  // Mount == turn start for a live turn; a reloaded (already-settled) turn captures no
  // client start, so it falls back to backend metrics only. `elapsed`/`ttftMs` are STATE
  // (read during render) written only off the interval tick or the effect cleanup — never
  // synchronously in the effect body — so the live clock ticks without a render-time ref read.
  const [startedAt] = React.useState<number | null>(() =>
    streaming ? now() : null,
  );
  const [elapsed, setElapsed] = React.useState(0);
  const [ttftMs, setTtftMs] = React.useState<number | null>(null);

  // Latest message for the interval closure (TTFT is sampled off the tick, not re-bound).
  const messageRef = React.useRef(message);
  React.useEffect(() => {
    messageRef.current = message;
  });

  React.useEffect(() => {
    if (startedAt === null || !streaming) return;
    const tick = () => {
      setElapsed(now() - startedAt);
      if (hasVisibleContent(messageRef.current)) {
        setTtftMs((prev) => prev ?? now() - startedAt);
      }
    };
    const id = setInterval(tick, 100);
    // Freeze the final elapsed the moment the turn settles/unmounts (cleanup, not body).
    return () => {
      clearInterval(id);
      setElapsed(now() - startedAt);
    };
  }, [streaming, startedAt, now]);

  const metrics = message.metrics;
  const durationMs =
    metrics?.durationMs ?? (startedAt !== null ? elapsed : undefined);
  const resolvedTtftMs = metrics?.ttftMs ?? ttftMs ?? undefined;
  const totalTokens = metrics ? resolveTotalTokens(metrics) : undefined;
  const costUsd = metrics?.costUsd;

  const stats: Array<{ icon: React.ElementType; label: string; text: string }> =
    [];
  if (durationMs != null)
    stats.push({ icon: ClockIcon, label: "Total time", text: formatDuration(durationMs) });
  if (resolvedTtftMs != null)
    stats.push({ icon: ZapIcon, label: "Time to first token", text: `TTFT ${formatDuration(resolvedTtftMs)}` });
  if (totalTokens != null)
    stats.push({ icon: TbCoin, label: "Tokens", text: `${formatTokens(totalTokens)} tokens` });
  if (costUsd != null)
    stats.push({ icon: FaMoneyBillWave, label: "Cost", text: formatCost(costUsd) });

  if (stats.length === 0) return null;

  return (
    <div
      data-slot="message-metrics"
      role="group"
      aria-label="Response metrics"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground/80 tabular-nums",
        className,
      )}
      {...props}
    >
      {stats.map(({ icon: Icon, label, text }) => (
        <span
          key={label}
          title={label}
          className="inline-flex items-center gap-1 whitespace-nowrap"
        >
          <Icon className="size-3 shrink-0" aria-hidden />
          {text}
        </span>
      ))}
    </div>
  );
}

export default MessageMetrics;
