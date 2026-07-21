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

  it("is a collapsed icon rail by default and opens the settings dialog on the toggle", () => {
    renderControl();
    // Collapsed rail: play + restart + settings, but no dialog / timing controls yet.
    expect(screen.queryByLabelText("Text delay")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /play replay/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show replay settings/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  it("exposes the timing controls inside the dialog and no longer docks the todo strip (todos live on the composer)", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: /show replay settings/i }));
    expect(screen.getByLabelText("Text delay")).toBeInTheDocument();
    expect(screen.getByLabelText("Tool delay")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="todo-card"]')).toBeNull();
  });

  it("lets the user paste recording text, pushing it as an upload source", () => {
    const { handlers } = renderControl(idleSession({ source: "upload" }));
    fireEvent.click(screen.getByRole("button", { name: /show replay settings/i }));

    const textarea = screen.getByLabelText(/paste recording/i);
    fireEvent.change(textarea, {
      target: { value: 'data: {"type":"response.output_text.delta","delta":"hi"}\n\n' },
    });

    expect(handlers.onSetSource).toHaveBeenCalledWith({
      kind: "upload",
      fileName: "Pasted recording",
      text: 'data: {"type":"response.output_text.delta","delta":"hi"}\n\n',
    });
  });

  it("hides the paste field for the default source", () => {
    renderControl(idleSession({ source: "default" }));
    fireEvent.click(screen.getByRole("button", { name: /show replay settings/i }));
    expect(screen.queryByLabelText(/paste recording/i)).toBeNull();
  });

  it("switches source via the segmented control instead of a dropdown", () => {
    const { handlers } = renderControl(idleSession({ source: "default" }));
    fireEvent.click(screen.getByRole("button", { name: /show replay settings/i }));
    // The Custom tab flips the source to an (empty) upload, keeping Play blocked.
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }));
    expect(handlers.onSetSource).toHaveBeenCalledWith({
      kind: "upload",
      fileName: "",
      text: "",
    });
  });

  it("starts playback from the dialog and closes it (no need to close first)", () => {
    const { handlers } = renderControl(idleSession({ source: "default" }));
    fireEvent.click(screen.getByRole("button", { name: /show replay settings/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /start replay/i }));
    expect(handlers.onPlay).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clears a pasted recording back to an empty upload source", () => {
    const { handlers } = renderControl(
      idleSession({ source: "upload", fileName: "Pasted recording" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /show replay settings/i }));
    fireEvent.change(screen.getByLabelText(/paste recording/i), {
      target: { value: "data: {}\n\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: /clear recording/i }));
    expect(handlers.onSetSource).toHaveBeenLastCalledWith({
      kind: "upload",
      fileName: "",
      text: "",
    });
  });
});
