import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContextMeter } from "@/components/chat/context-meter";
import type { ContextUsage } from "@/lib/chat/metrics";

const usage = (over: Partial<ContextUsage> = {}): ContextUsage => ({
  used: 12400,
  limit: 200000,
  level: "normal",
  ...over,
});

describe("ContextMeter — ring (004)", () => {
  it("renders a ring gauge carrying the level + percent", () => {
    render(<ContextMeter usage={usage({ level: "warn", used: 144000 })} />);
    const meter = screen.getByRole("img", { name: /72% context used/i });
    expect(meter).toHaveAttribute("data-slot", "context-meter");
    expect(meter).toHaveAttribute("data-level", "warn");
  });

  it("renders nothing when occupancy is unmeasurable", () => {
    const { container } = render(
      <ContextMeter usage={usage({ level: "unknown", used: 0 })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("is a non-interactive gauge below the compact threshold", () => {
    render(<ContextMeter usage={usage({ used: 12400 })} onCompact={vi.fn()} />);
    // 12.4k < 50k → not a button.
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("img", { name: /context used/i })).toBeInTheDocument();
  });

  it("becomes a click-to-/compact button once occupancy passes 50k tokens", () => {
    const onCompact = vi.fn();
    render(
      <ContextMeter usage={usage({ used: 120000 })} onCompact={onCompact} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /compact/i }));
    expect(onCompact).toHaveBeenCalledOnce();
  });

  it("disables the compact click while a generation is busy", () => {
    render(
      <ContextMeter usage={usage({ used: 120000 })} onCompact={vi.fn()} busy />,
    );
    expect(screen.getByRole("button", { name: /compact/i })).toBeDisabled();
  });

  it("stays a plain gauge when no compact handler is wired", () => {
    render(<ContextMeter usage={usage({ used: 120000 })} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("forwards className", () => {
    render(<ContextMeter usage={usage()} className="ml-2" />);
    expect(screen.getByRole("img")).toHaveClass("ml-2");
  });
});
