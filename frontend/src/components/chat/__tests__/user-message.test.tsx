import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Message } from "@/entities";
import { UserMessage } from "@/components/chat/user-message";

function userMessage(over: Partial<Message> = {}): Message {
  return {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "hi" }],
    attachments: [],
    status: "complete",
    error: null,
    feedback: null,
    createdAt: 0,
    ...over,
  };
}

describe("UserMessage attachments (T071)", () => {
  it("renders no attachment chip when there are none", () => {
    render(<UserMessage message={userMessage()} />);
    expect(screen.queryByText(/KB|MB|B$/)).toBeNull();
  });

  it("renders a filename+size chip per attachment, uniform for every file type", () => {
    render(
      <UserMessage
        message={userMessage({
          attachments: [
            {
              id: "a1",
              name: "cat.png",
              mimeType: "image/png",
              size: 2048,
              dataUrl: "data:image/png;base64,AAAA",
            },
            {
              id: "a2",
              name: "report.pdf",
              mimeType: "application/pdf",
              size: 1024,
              dataUrl: "data:application/pdf;base64,BBBB",
            },
          ],
        })}
      />,
    );
    expect(screen.getByText("cat.png")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("1 KB")).toBeInTheDocument();
  });
});
