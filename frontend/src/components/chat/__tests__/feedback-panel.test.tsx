import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeedbackPanel } from "@/components/chat/feedback-panel";

describe("FeedbackPanel (US3)", () => {
  it("submits the chosen rating to the sink", () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(<FeedbackPanel messageId="m1" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Good response" }));
    expect(onSubmit).toHaveBeenCalledWith({ messageId: "m1", rating: "up" });
  });

  it("reflects the current selection via aria-pressed", () => {
    render(
      <FeedbackPanel messageId="m1" value="down" onSubmit={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: "Bad response" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a saved comment when the reply already has feedback (restored)", () => {
    render(
      <FeedbackPanel
        messageId="m1"
        value="up"
        comment="loved it"
        onSubmit={vi.fn()}
      />,
    );
    // The comment box is revealed on mount (a rating exists) and seeded with the note.
    expect(screen.getByLabelText("Feedback comment")).toHaveValue("loved it");
  });

  it("keeps the selection and shows a notice when submit rejects (non-blocking)", async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error("network")));
    render(<FeedbackPanel messageId="m1" value="up" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Good response" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/couldn't save/i),
    );
    // Selection is retained (still shows the up choice as pressed via value prop).
    expect(
      screen.getByRole("button", { name: "Good response" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
