import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatComposer } from "@/components/chat/chat-composer";

describe("ChatComposer (US1 send + US2 stop)", () => {
  it("sends non-blank text on click and clears the input", () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} />);

    const input = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(onSend).toHaveBeenCalledWith("hello");
    expect(input).toHaveValue("");
  });

  it("keeps send disabled for blank input", () => {
    render(<ChatComposer onSend={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("shows a stop affordance only while busy with an empty composer", () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ChatComposer onSend={vi.fn()} onCancel={onCancel} busy={false} />,
    );
    // Not busy → no stop button.
    expect(screen.queryByRole("button", { name: "Stop generating" })).toBeNull();

    // Busy + empty → stop button; clicking it cancels.
    rerender(<ChatComposer onSend={vi.fn()} onCancel={onCancel} busy />);
    fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(onCancel).toHaveBeenCalledOnce();

    // Typing while busy swaps stop → send (to queue another message).
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "queued" },
    });
    expect(screen.queryByRole("button", { name: "Stop generating" })).toBeNull();
    expect(screen.getByRole("button", { name: "Queue message" })).toBeEnabled();
  });
});
