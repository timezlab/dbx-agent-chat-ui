import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContextMeter } from "@/components/chat/context-meter";
import type { ContextUsage } from "@/lib/chat/metrics";

const usage = (over: Partial<ContextUsage> = {}): ContextUsage => ({
  used: 12400,
  limit: 200000,
  pct: 6,
  level: "normal",
  ...over,
});

describe("ContextMeter (004)", () => {
  it("renders compact used / limit · pct", () => {
    render(<ContextMeter usage={usage()} />);
    const meter = screen.getByRole("group", { name: /context/i });
    expect(meter).toHaveTextContent("12k / 200k · 6%");
  });

  it("exposes the level so warn/danger can restyle", () => {
    const { rerender } = render(<ContextMeter usage={usage({ level: "warn", pct: 72 })} />);
    expect(screen.getByRole("group", { name: /context/i })).toHaveAttribute(
      "data-level",
      "warn",
    );
    rerender(<ContextMeter usage={usage({ level: "danger", pct: 95 })} />);
    expect(screen.getByRole("group", { name: /context/i })).toHaveAttribute(
      "data-level",
      "danger",
    );
  });

  it("renders nothing when the level is unknown (no measurable usage)", () => {
    const { container } = render(
      <ContextMeter usage={usage({ level: "unknown", used: 0, pct: 0 })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("forwards className", () => {
    render(<ContextMeter usage={usage()} className="ml-2" />);
    expect(screen.getByRole("group", { name: /context/i })).toHaveClass("ml-2");
  });
});
