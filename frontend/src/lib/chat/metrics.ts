import type { Message, MessageMetrics } from "@/entities";

/**
 * Pure display formatters for the per-reply usage/metrics footer (time · TTFT · tokens ·
 * cost) and per-tool run-time. Kept side-effect-free so they are unit-testable and safe to
 * call in render; the live client clock (measurement) lives in the `MessageMetrics`
 * component, not here.
 */

/** Human duration for a latency (TTFT) or total: sub-minute as `4.2s`, else `1m 23s`. */
export function formatDuration(ms: number): string {
  const clamped = Number.isFinite(ms) && ms > 0 ? ms : 0;
  if (clamped < 60_000) return `${(clamped / 1000).toFixed(1)}s`;
  const m = Math.floor(clamped / 60_000);
  const s = Math.round((clamped % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/**
 * Compact token count so large usage stays short: `556`, `1.2k`, `18k`, `1.9M`. Backends can
 * report millions of tokens (large context / cached prompts), which would overflow the footer
 * with full grouping — so abbreviate at 1k+. Exact below 1,000; fixed en-US so it is stable.
 */
export function formatTokens(n: number): string {
  const v = Math.round(Number.isFinite(n) && n > 0 ? n : 0);
  if (v < 1000) return `${v}`;
  if (v < 1_000_000) {
    const k = v / 1000;
    return `${k < 10 ? k.toFixed(1) : Math.round(k)}k`;
  }
  const m = v / 1_000_000;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)}M`;
}

/** Cost in USD: `$0.0041` for sub-dollar (4 dp), `$1.23` at a dollar and up (2 dp). */
export function formatCost(usd: number): string {
  const v = Number.isFinite(usd) && usd > 0 ? usd : 0;
  return `$${v >= 1 ? v.toFixed(2) : v.toFixed(4)}`;
}

/** The single token number to display — the backend total, else input+output when given. */
export function resolveTotalTokens(m: MessageMetrics): number | undefined {
  if (m.totalTokens != null) return m.totalTokens;
  if (m.inputTokens != null || m.outputTokens != null) {
    return (m.inputTokens ?? 0) + (m.outputTokens ?? 0);
  }
  return undefined;
}

/** Whether a metrics object carries any backend numbers worth rendering (tokens/cost). */
export function hasBackendMetrics(m: MessageMetrics | undefined): boolean {
  if (!m) return false;
  return (
    m.totalTokens != null ||
    m.inputTokens != null ||
    m.outputTokens != null ||
    m.costUsd != null
  );
}

/** True when a turn has any visible streamed content (text/reasoning/tools) — the moment
 *  time-to-first-token is measured. */
export function hasVisibleContent(message: Message): boolean {
  return message.parts.some(
    (p) =>
      (p.type === "text" && p.text.length > 0) ||
      (p.type === "reasoning" && p.text.length > 0) ||
      (p.type === "tools" && p.items.length > 0),
  );
}
