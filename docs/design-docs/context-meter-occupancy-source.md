# Context-Meter Occupancy Source: backend `context_used`, not usage totals

**Status:** accepted
**Date:** 2026-07-07
**Covers:** spec 004 (FR-001, FR-010) — context-window meter
**Related:** [`request-context-ownership.md`](./request-context-ownership.md) (thin request + two-layer model)

## Context

The context-window meter shows how full the agent's **Checkpoint** (working context) is.
The first implementation derived occupancy from the latest assistant turn's *usage tokens*:

```ts
const used = resolveTotalTokens(m.metrics); // totalTokens ?? inputTokens + outputTokens
```

That is wrong for a Databricks **ResponsesAgent**, which is a **looping** agent
(think → tool → think → tool → … → answer). The `usage` a looping agent reports is a
**billing/consumption** number — the sum of tokens across *every internal LLM step* in the
turn — not the size of the context at rest:

- A turn with N internal tool-steps re-sends the (growing) context on each step, so
  `input_tokens` ≈ Σ over N steps and `total_tokens` = `input + output` is several times the
  real Checkpoint occupancy.
- Result: the meter jumps to danger almost immediately even when the Checkpoint is nearly
  empty. `total_tokens` measures *what the turn cost*, not *how full the window is*.

`input_tokens` alone does not save it either — for a loop it is likewise cumulative (or, at
best, only the last step's prompt, which no backend guarantees). **Occupancy cannot be
derived from consumption usage; it must be reported by the party that owns the Checkpoint.**

## Decision

1. **The meter reads a dedicated backend field: `context_used`** (wire snake_case;
   `checkpoint_tokens` accepted as an alias), carried on the same `usage` frame as
   `context_window`. It is the *current Checkpoint token count after this turn* — a point-in-time
   occupancy, not a per-turn sum. It maps to `MessageMetrics.contextUsed` (camelCase).

2. **No proxy fallback for the meter.** When a turn carries no `context_used`,
   `resolveContextUsage` skips it; if no turn in the conversation has one, the reading is
   `level: "unknown"` and **the ring renders nothing**. We do not fall back to
   `resolveTotalTokens` — a fabricated, near-full ring erodes trust more than an absent one.

3. **`resolveTotalTokens` stays — but only for the per-reply footer** (time · TTFT · tokens ·
   cost), where "total tokens this reply consumed" is exactly the right, honest number. The
   meter and the footer measure two different things and now use two different fields.

4. **Symmetry with the limit.** Occupancy (`context_used`) and the denominator
   (`context_window`) are both backend-authoritative, both optional, both fall through the same
   extractor. The limit still falls back to `config.contextWindow` when absent; occupancy does
   **not** fall back — an unknown numerator hides the meter, an unknown denominator only swaps
   in the configured default.

5. **`/compact` re-reports.** The backend emits a fresh `usage` frame carrying the smaller
   `context_used` after it compacts (it need not carry content), so the ring drops as soon as
   compaction settles — the behaviour the whole feature exists to show.

## Alternatives considered

- **Keep `total_tokens` as occupancy.** Simplest, no contract change. Rejected: for a looping
  agent it is cumulative and over-counts by the number of internal steps — the meter would be
  actively misleading, which defeats the feature.
- **Use `input_tokens` of the final internal step.** Closer to occupancy *if* the backend
  reports per-final-step input, but no backend guarantees that decomposition; it is unreliable
  and unverifiable from the client. Rejected.
- **Client-side token estimation of the Checkpoint.** The client does not see the Checkpoint
  (thin request — it only sends the current turn), so it has nothing to estimate from.
  Rejected.
- **Proxy fallback (`context_used ?? total_tokens`).** Rejected per decision #2: better to show
  nothing than a wrong number.

## Consequences

**Better**

- The ring is honest for agentic backends: it tracks Checkpoint occupancy, not turn cost.
- `/compact` visibly lowers the ring (backend re-reports `context_used`).
- Clean split: footer = consumption (`total_tokens`), meter = occupancy (`context_used`).

**Worse / trade-offs**

- The meter now **requires** a backend that reports `context_used`. Until it does, the ring is
  simply hidden (US1 degrades to nothing rather than to a wrong bar). This is the load-bearing
  external dependency for US1's visible value.

**Must now be true**

- The backend reports `context_used` (or `checkpoint_tokens`) on the `usage` frame — including
  a fresh frame after `/compact`.
- `resolveContextUsage` keys off `metrics.contextUsed` only; it never derives occupancy from
  `resolveTotalTokens`.
- `resolveTotalTokens` remains wired to the per-reply metrics footer, unchanged.
