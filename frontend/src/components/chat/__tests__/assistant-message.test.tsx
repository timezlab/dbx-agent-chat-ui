import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Message } from "@/entities";
import { AssistantMessage } from "@/components/chat/messages/assistant-message";

function assistant(over: Partial<Message> = {}): Message {
  return {
    id: "a",
    role: "assistant",
    parts: [],
    attachments: [],
    status: "complete",
    error: null,
    feedback: null,
    createdAt: 0,
    ...over,
  };
}

describe("AssistantMessage rendering (US3)", () => {
  it("folds a tools part into a collapsed activity group summarizing the last step", () => {
    const message = assistant({
      parts: [
        {
          type: "tools",
          items: [
            {
              id: "call_1",
              name: "read_file",
              args: { file_path: "a.ts" },
              detail: null,
              status: "done",
            },
          ],
        },
      ],
    });
    render(<AssistantMessage message={message} />);
    // A settled turn folds its activity into ONE collapsed "process" dropdown; the
    // header summarizes the last step (verb + primary arg), the body stays collapsed.
    expect(
      document.querySelector('[data-slot="activity-group"]'),
    ).not.toBeNull();
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("a.ts")).toBeInTheDocument();
  });

  it("resolves reference-style links and renders base64 images in a settled turn", () => {
    const message = assistant({
      parts: [
        {
          type: "text",
          text:
            "See [[1] doc.md][w1] for detail.\n\n" +
            "![chart](data:image/png;base64,iVBORw0KGgo=)\n\n" +
            "[w1]: https://example.com/doc.md",
        },
      ],
    });
    render(<AssistantMessage message={message} />);
    // Reference resolved to a link (streamdown renders links as buttons), not raw source.
    expect(document.body.innerHTML).not.toContain("][w1]");
    expect(document.body.innerHTML).not.toContain("[w1]:");
    expect(document.querySelector('[data-streamdown="link"]')).not.toBeNull();
    // Base64 image rendered by us (Streamdown blocks data: URIs) as a real <img>.
    const img = document.querySelector('img[data-slot="assistant-image"]');
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toContain("data:image/png;base64,");
  });

  it("renders an inline error below partial output", () => {
    const message = assistant({
      status: "error",
      error: "upstream failed",
      parts: [{ type: "text", text: "partial" }],
    });
    render(<AssistantMessage message={message} />);
    expect(screen.getByRole("alert").textContent).toMatch(/upstream failed/);
  });

  it("shows the feedback panel only on a settled turn with content", () => {
    const onFeedback = vi.fn();
    const streaming = assistant({
      status: "streaming",
      parts: [{ type: "text", text: "typing" }],
    });
    const { rerender } = render(
      <AssistantMessage message={streaming} onFeedback={onFeedback} />,
    );
    expect(
      screen.queryByRole("button", { name: "Good response" }),
    ).toBeNull();

    rerender(
      <AssistantMessage
        message={assistant({ parts: [{ type: "text", text: "done" }] })}
        onFeedback={onFeedback}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Good response" }),
    ).toBeInTheDocument();
  });

  it("shows copy + download on ONE action row, with the feedback thumbs, on a settled turn", () => {
    const onFeedback = vi.fn();
    const onDownloadRecording = vi.fn();
    const { container } = render(
      <AssistantMessage
        message={assistant({ parts: [{ type: "text", text: "the answer" }] })}
        onFeedback={onFeedback}
        onDownloadRecording={onDownloadRecording}
      />,
    );
    const copy = container.querySelector('[data-slot="assistant-copy"]');
    const download = container.querySelector(
      '[data-slot="assistant-download-recording"]',
    );
    const thumb = screen.getByRole("button", { name: "Good response" });
    expect(copy).not.toBeNull();
    expect(download).not.toBeNull();
    // All three live in the SAME toolbar row (the feedback form/card is a separate sibling).
    expect(copy?.parentElement).toBe(download?.parentElement);
    expect(thumb.parentElement).toBe(copy?.parentElement);

    fireEvent.click(download!);
    expect(onDownloadRecording).toHaveBeenCalledOnce();
  });

  it("copies the reply's markdown to the clipboard", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const { container } = render(
      <AssistantMessage
        message={assistant({ parts: [{ type: "text", text: "**copy me**" }] })}
      />,
    );
    fireEvent.click(container.querySelector('[data-slot="assistant-copy"]')!);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("**copy me**"));
  });

  it("renders an inline <suggested-followups> block as clickable follow-up buttons", () => {
    const onSendPrompt = vi.fn();
    render(
      <AssistantMessage
        message={assistant({
          parts: [
            {
              type: "text",
              text:
                "Here is the report.\n\n<suggested-followups><question>Break down by region?</question><question>Show Q2 detail?</question></suggested-followups>",
            },
          ],
        })}
        onSendPrompt={onSendPrompt}
      />,
    );
    const first = screen.getByRole("button", { name: /Break down by region\?/ });
    expect(first).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Show Q2 detail\?/ }),
    ).toBeInTheDocument();
    // The raw tag never leaks into the DOM as text.
    expect(document.body.innerHTML).not.toContain("suggested-followups");

    fireEvent.click(first);
    expect(onSendPrompt).toHaveBeenCalledWith("Break down by region?");
  });

  it("hides the follow-up block while streaming (only the answer text shows)", () => {
    render(
      <AssistantMessage
        message={assistant({
          status: "streaming",
          parts: [
            {
              type: "text",
              text:
                "Partial answer <suggested-followups><question>Later?</question></suggested-followups>",
            },
          ],
        })}
      />,
    );
    expect(screen.queryByRole("button", { name: /Later\?/ })).toBeNull();
    expect(document.body.innerHTML).not.toContain("suggested-followups");
  });

  it("strips the follow-up block from the copied reply text", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const { container } = render(
      <AssistantMessage
        message={assistant({
          parts: [
            {
              type: "text",
              text:
                "The answer.\n\n<suggested-followups><question>More?</question></suggested-followups>",
            },
          ],
        })}
      />,
    );
    fireEvent.click(container.querySelector('[data-slot="assistant-copy"]')!);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("The answer."));
  });

  it("offers copy even without a feedback sink, but not while streaming", () => {
    const { container, rerender } = render(
      <AssistantMessage
        message={assistant({ parts: [{ type: "text", text: "done" }] })}
      />,
    );
    expect(container.querySelector('[data-slot="assistant-copy"]')).not.toBeNull();

    rerender(
      <AssistantMessage
        message={assistant({
          status: "streaming",
          parts: [{ type: "text", text: "typing" }],
        })}
      />,
    );
    expect(container.querySelector('[data-slot="assistant-copy"]')).toBeNull();
  });
});
