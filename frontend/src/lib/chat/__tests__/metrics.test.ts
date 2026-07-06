import { describe, expect, it } from "vitest";

import {
  formatCost,
  formatDuration,
  formatTokens,
  hasBackendMetrics,
  resolveTotalTokens,
} from "@/lib/chat/metrics";

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

  it("groups token counts", () => {
    expect(formatTokens(1203)).toBe("1,203");
    expect(formatTokens(42)).toBe("42");
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
