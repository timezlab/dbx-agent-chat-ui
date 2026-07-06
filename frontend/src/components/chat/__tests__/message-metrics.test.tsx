import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Message, MessageMetrics as Metrics } from "@/entities";
import { MessageMetrics } from "@/components/chat/messages/message-metrics";

function assistant(overrides: Partial<Message> = {}): Message {
  return {
    id: "a1",
    role: "assistant",
    parts: [{ type: "text", text: "hello" }],
    attachments: [],
    status: "complete",
    error: null,
    feedback: null,
    createdAt: 1,
    ...overrides,
  };
}

describe("MessageMetrics", () => {
  it("shows backend tokens + cost on a settled turn", () => {
    const metrics: Metrics = { totalTokens: 1203, costUsd: 0.0041 };
    render(<MessageMetrics message={assistant({ metrics })} streaming={false} />);

    expect(screen.getByText("1.2k tokens")).toBeInTheDocument();
    expect(screen.getByText("$0.0041")).toBeInTheDocument();
  });

  it("renders nothing for a reloaded turn with no metrics (never streamed here)", () => {
    const { container } = render(
      <MessageMetrics message={assistant()} streaming={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows a live total clock while streaming even without backend metrics", () => {
    render(
      <MessageMetrics
        message={assistant({ status: "streaming" })}
        streaming
        now={() => 1000}
      />,
    );
    // Clock starts at mount (now=1000) and reads 0.0s on the first frame.
    expect(screen.getByText("0.0s")).toBeInTheDocument();
  });

  it("prefers a backend-reported duration/ttft over the client clock", () => {
    const metrics: Metrics = { durationMs: 4200, ttftMs: 800 };
    render(<MessageMetrics message={assistant({ metrics })} streaming={false} />);
    expect(screen.getByText("4.2s")).toBeInTheDocument();
    expect(screen.getByText("TTFT 0.8s")).toBeInTheDocument();
  });
});
