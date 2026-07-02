import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReplaySession } from "@/hooks/chat/use-chat";
import { ReplayControl } from "@/components/chat/replay-control";

function idleSession(overrides: Partial<ReplaySession> = {}): ReplaySession {
  return {
    status: "idle",
    source: "default",
    textDelayMs: 20,
    toolDelayMs: 400,
    speed: 1,
    error: null,
    ...overrides,
  };
}

function renderControl(
  session: ReplaySession = idleSession(),
  props: Partial<React.ComponentProps<typeof ReplayControl>> = {},
) {
  const handlers = {
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onSetSource: vi.fn(),
    onSetTiming: vi.fn(),
    onResetTiming: vi.fn(),
    onSetSpeed: vi.fn(),
  };
  const utils = render(
    <ReplayControl session={session} {...handlers} {...props} />,
  );
  return { ...utils, handlers };
}

describe("ReplayControl (US1)", () => {
  it("matches the composer footprint (same card shell) and forwards className", () => {
    const { container } = renderControl(idleSession(), {
      className: "custom-marker",
    });
    const root = container.querySelector('[data-slot="replay-control"]');
    expect(root).not.toBeNull();
    // Same rounded card shell + border as the composer, so toggling causes no shift.
    expect(root?.className).toContain("rounded-2xl");
    expect(root?.className).toContain("border");
    expect(root?.className).toContain("custom-marker");
  });

  it("shows the default source and enables Play with it", () => {
    renderControl();
    const play = screen.getByRole("button", { name: /play replay/i });
    expect(play).toBeEnabled();
  });

  it("blocks Play when an upload source has no valid file yet", () => {
    renderControl(idleSession({ source: "upload", fileName: undefined }));
    const play = screen.getByRole("button", { name: /play replay/i });
    expect(play).toBeDisabled();
  });

  it("docks the agent todo strip above the controls", () => {
    const { container } = renderControl(idleSession(), {
      todos: [{ content: "step one", status: "in_progress" }],
    });
    expect(container.querySelector('[data-slot="todo-card"]')).not.toBeNull();
  });
});
