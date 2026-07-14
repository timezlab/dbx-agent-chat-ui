import { fireEvent, render, screen } from "@testing-library/react";
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
    onReset: vi.fn(),
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
  it("renders as a bordered panel and forwards className", () => {
    const { container } = renderControl(idleSession(), {
      className: "custom-marker",
    });
    const root = container.querySelector('[data-slot="replay-control"]');
    expect(root).not.toBeNull();
    expect(root?.className).toContain("rounded-2xl");
    expect(root?.className).toContain("border");
    expect(root?.className).toContain("custom-marker");
  });

  it("is collapsed to an icon rail by default and expands on the settings toggle", () => {
    const { container } = renderControl();
    // Collapsed: play + restart + settings, but no timing controls or source select yet.
    expect(container.querySelector('[data-expanded="false"]')).not.toBeNull();
    expect(screen.queryByLabelText("Text delay")).toBeNull();
    expect(screen.getByRole("button", { name: /play replay/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show replay settings/i }));
    expect(container.querySelector('[data-expanded="true"]')).not.toBeNull();
    expect(screen.getByLabelText("Text delay")).toBeInTheDocument();
  });

  it("clears the chat via the restart control", () => {
    const { handlers } = renderControl();
    fireEvent.click(screen.getByRole("button", { name: /restart replay/i }));
    expect(handlers.onReset).toHaveBeenCalledOnce();
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

  it("exposes the timing controls once expanded and no longer docks the todo strip (todos live on the composer)", () => {
    const { container } = renderControl();
    fireEvent.click(screen.getByRole("button", { name: /show replay settings/i }));
    expect(screen.getByLabelText("Text delay")).toBeInTheDocument();
    expect(screen.getByLabelText("Tool delay")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="todo-card"]')).toBeNull();
  });
});
