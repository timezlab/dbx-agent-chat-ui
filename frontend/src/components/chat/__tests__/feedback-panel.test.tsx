import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeedbackPanel } from "@/components/chat/feedback-panel";

describe("FeedbackPanel (US3)", () => {
  it("clicking a thumb only selects it — nothing is sent until Submit", () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(<FeedbackPanel messageId="m1" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Good response" }));
    // The rating is now selected (form open) but NO submission has fired yet.
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Good response" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    // Submitted with the rating, no comment (none was added).
    expect(onSubmit).toHaveBeenCalledWith({ messageId: "m1", rating: "up" });
  });

  it("composes the comment from a chosen reason chip + the Other text", async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(<FeedbackPanel messageId="m1" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Bad response" }));
    fireEvent.click(screen.getByRole("button", { name: "Incorrect results" }));
    fireEvent.click(screen.getByRole("button", { name: "Other…" }));
    fireEvent.change(screen.getByLabelText("Feedback comment"), {
      target: { value: "cited a wrong table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledWith({
      messageId: "m1",
      rating: "down",
      comment: "Incorrect results — cited a wrong table",
    });
  });

  it("reflects the current selection via aria-pressed", () => {
    render(<FeedbackPanel messageId="m1" value="down" onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Bad response" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the saved comment when the reply already has feedback (restored)", () => {
    render(
      <FeedbackPanel
        messageId="m1"
        value="up"
        comment="loved it"
        onSubmit={vi.fn()}
      />,
    );
    // Restored feedback lands in the confirmation state — the note is shown as text.
    expect(screen.getByText("loved it")).toBeInTheDocument();
  });

  it("keeps the form and shows a notice when submit rejects (non-blocking)", async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error("network")));
    render(<FeedbackPanel messageId="m1" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Good response" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/couldn't save/i),
    );
    // Selection retained and the form is still open for a retry.
    expect(
      screen.getByRole("button", { name: "Good response" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });
});
