import { describe, expect, it } from "vitest";

import type { Message, MessageMetrics } from "@/entities";
import {
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
  it("measures the last assistant turn's occupancy against the config limit", () => {
    const usage = resolveContextUsage(
      [user(), assistant({ totalTokens: 12400 })],
      200000,
    );
    expect(usage).toEqual({ used: 12400, limit: 200000, pct: 6, level: "normal" });
  });

  it("prefers the backend-reported contextWindow over the config limit", () => {
    const usage = resolveContextUsage(
      [assistant({ totalTokens: 64000, contextWindow: 128000 })],
      200000,
    );
    expect(usage.limit).toBe(128000);
    expect(usage.pct).toBe(50);
    expect(usage.level).toBe("normal");
  });

  it("flags warn at ≥70% and danger at ≥90%", () => {
    expect(resolveContextUsage([assistant({ totalTokens: 140000 })], 200000).level).toBe(
      "warn",
    );
    expect(resolveContextUsage([assistant({ totalTokens: 185000 })], 200000).level).toBe(
      "danger",
    );
  });

  it("clamps the percentage to 0–100 when usage overflows the limit", () => {
    const usage = resolveContextUsage([assistant({ totalTokens: 260000 })], 200000);
    expect(usage.pct).toBe(100);
    expect(usage.level).toBe("danger");
  });

  it("reads the LAST assistant turn that carries resolvable tokens", () => {
    const usage = resolveContextUsage(
      [assistant({ totalTokens: 1000 }), user(), assistant({ totalTokens: 5000 })],
      200000,
    );
    expect(usage.used).toBe(5000);
  });

  it("is unknown when no assistant turn has resolvable tokens", () => {
    expect(resolveContextUsage([user()], 200000).level).toBe("unknown");
    expect(resolveContextUsage([assistant()], 200000).level).toBe("unknown");
    expect(resolveContextUsage([assistant({ costUsd: 0.01 })], 200000).level).toBe(
      "unknown",
    );
  });
});
