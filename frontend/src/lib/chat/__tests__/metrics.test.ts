import { describe, expect, it } from "vitest";

import type { Message, MessageMetrics } from "@/entities";
import {
  contextPct,
  formatCost,
  formatDuration,
  formatTokens,
  hasBackendMetrics,
  resolveContextUsage,
  resolveTotalTokens,
} from "@/lib/chat/metrics";

function assistant(metrics?: MessageMetrics): Message {
  return {
    id: "a1",
    role: "assistant",
    parts: [{ type: "text", text: "hi" }],
    attachments: [],
    status: "complete",
    error: null,
    feedback: null,
    ...(metrics ? { metrics } : {}),
    createdAt: 1,
  };
}

function user(): Message {
  return {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "q" }],
    attachments: [],
    status: "complete",
    error: null,
    feedback: null,
    createdAt: 0,
  };
}

describe("metrics formatters", () => {
  it("formats sub-minute durations to one decimal second", () => {
    expect(formatDuration(812)).toBe("0.8s");
    expect(formatDuration(4200)).toBe("4.2s");
    expect(formatDuration(0)).toBe("0.0s");
    expect(formatDuration(-5)).toBe("0.0s");
  });

  it("formats minute-plus durations as `Xm Ys`", () => {
    expect(formatDuration(83_000)).toBe("1m 23s");
    expect(formatDuration(600_000)).toBe("10m 0s");
  });

  it("abbreviates token counts (exact under 1k, then k / M)", () => {
    expect(formatTokens(42)).toBe("42");
    expect(formatTokens(556)).toBe("556");
    expect(formatTokens(1203)).toBe("1.2k");
    expect(formatTokens(18_000)).toBe("18k");
    expect(formatTokens(1_894_492)).toBe("1.9M");
  });

  it("formats cost with 4 dp under a dollar and 2 dp at/above", () => {
    expect(formatCost(0.0041)).toBe("$0.0041");
    expect(formatCost(1.5)).toBe("$1.50");
    expect(formatCost(0)).toBe("$0.0000");
  });

  it("resolves the total token count, falling back to input+output", () => {
    expect(resolveTotalTokens({ totalTokens: 150 })).toBe(150);
    expect(resolveTotalTokens({ inputTokens: 100, outputTokens: 50 })).toBe(150);
    expect(resolveTotalTokens({ inputTokens: 100 })).toBe(100);
    expect(resolveTotalTokens({ costUsd: 0.01 })).toBeUndefined();
  });

  it("detects whether backend metrics are present", () => {
    expect(hasBackendMetrics(undefined)).toBe(false);
    expect(hasBackendMetrics({ durationMs: 1000 })).toBe(false); // client-measurable only
    expect(hasBackendMetrics({ totalTokens: 10 })).toBe(true);
    expect(hasBackendMetrics({ costUsd: 0.01 })).toBe(true);
  });
});

describe("resolveContextUsage (004)", () => {
  it("takes occupancy from the last assistant turn's backend context_used", () => {
    const usage = resolveContextUsage(
      [user(), assistant({ contextUsed: 12400 })],
      200000,
    );
    expect(usage).toEqual({ used: 12400, limit: 200000, level: "normal" });
  });

  it("ignores total_tokens for the meter — occupancy comes only from context_used", () => {
    // A looping agent reports a large cumulative total_tokens; without context_used the
    // meter must NOT treat that as occupancy — it stays unknown (renders nothing).
    expect(
      resolveContextUsage([assistant({ totalTokens: 500000 })], 200000).level,
    ).toBe("unknown");
    // When both are present, context_used wins as the numerator (not total_tokens).
    const usage = resolveContextUsage(
      [assistant({ totalTokens: 500000, contextUsed: 42000 })],
      200000,
    );
    expect(usage.used).toBe(42000);
  });

  it("prefers the backend-reported contextWindow over the config limit", () => {
    const usage = resolveContextUsage(
      [assistant({ contextUsed: 64000, contextWindow: 128000 })],
      200000,
    );
    expect(usage.limit).toBe(128000);
    expect(usage.level).toBe("normal");
  });

  it("flags warn at ≥70% and danger at ≥90%", () => {
    expect(resolveContextUsage([assistant({ contextUsed: 140000 })], 200000).level).toBe(
      "warn",
    );
    expect(resolveContextUsage([assistant({ contextUsed: 185000 })], 200000).level).toBe(
      "danger",
    );
  });

  it("classifies an overflow (used > limit) as danger", () => {
    const usage = resolveContextUsage([assistant({ contextUsed: 260000 })], 200000);
    expect(usage.level).toBe("danger");
    expect(contextPct(usage)).toBe(100); // derived + clamped
  });

  it("reads the LAST assistant turn that carries context_used", () => {
    const usage = resolveContextUsage(
      [assistant({ contextUsed: 1000 }), user(), assistant({ contextUsed: 5000 })],
      200000,
    );
    expect(usage.used).toBe(5000);
  });

  it("skips turns without context_used, using the latest that has it", () => {
    const usage = resolveContextUsage(
      [
        assistant({ contextUsed: 1000 }),
        user(),
        assistant({ totalTokens: 999999 }), // billing only, no occupancy → skipped
      ],
      200000,
    );
    expect(usage.used).toBe(1000);
  });

  it("is unknown when no assistant turn carries context_used", () => {
    expect(resolveContextUsage([user()], 200000).level).toBe("unknown");
    expect(resolveContextUsage([assistant()], 200000).level).toBe("unknown");
    expect(resolveContextUsage([assistant({ totalTokens: 12400 })], 200000).level).toBe(
      "unknown",
    );
  });
});

describe("contextPct (004)", () => {
  it("derives a clamped integer percent from used/limit", () => {
    expect(contextPct({ used: 12400, limit: 200000 })).toBe(6);
    expect(contextPct({ used: 100000, limit: 200000 })).toBe(50);
    expect(contextPct({ used: 260000, limit: 200000 })).toBe(100); // clamped
    expect(contextPct({ used: 10, limit: 0 })).toBe(0); // no divide-by-zero
  });
});
