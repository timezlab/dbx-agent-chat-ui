import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatEmpty } from "@/components/chat/chat-empty";

describe("ChatEmpty (empty-state redesign)", () => {
  it("shows only the greeting when no sample prompts are configured", () => {
    render(<ChatEmpty />);
    expect(screen.getByText("How can I help?")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="chat-empty-samples"]')).toBeNull();
  });

  it("renders a sample card per configured prompt", () => {
    render(<ChatEmpty samplePrompts={["Summarize this doc", "Write a SQL query"]} />);
    expect(screen.getByText("Summarize this doc")).toBeInTheDocument();
    expect(screen.getByText("Write a SQL query")).toBeInTheDocument();
    expect(
      document.querySelectorAll('[data-slot="chat-empty-sample"]'),
    ).toHaveLength(2);
  });

  it("sends the prompt text when a sample card is clicked", () => {
    const onSelectPrompt = vi.fn();
    render(
      <ChatEmpty
        samplePrompts={["Summarize this doc"]}
        onSelectPrompt={onSelectPrompt}
      />,
    );

    fireEvent.click(screen.getByText("Summarize this doc"));
    expect(onSelectPrompt).toHaveBeenCalledWith("Summarize this doc");
  });

  it("disables sample cards when disabled (e.g. no chat endpoint configured)", () => {
    render(<ChatEmpty samplePrompts={["Try me"]} disabled />);
    const card = screen.getByText("Try me").closest("button");
    expect(card).toBeDisabled();
  });
});
