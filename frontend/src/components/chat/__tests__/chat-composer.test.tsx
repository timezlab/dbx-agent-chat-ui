import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatComposer } from "@/components/chat/chat-composer";
import type { ContextUsage } from "@/lib/chat/metrics";

function file(name: string, mimeType: string, content = "x"): File {
  return new File([content], name, { type: mimeType });
}

const contextUsage = (over: Partial<ContextUsage> = {}): ContextUsage => ({
  used: 120000,
  limit: 200000,
  level: "normal",
  ...over,
});

describe("ChatComposer (US1 send + US2 stop)", () => {
  it("sends non-blank text on click and clears the input", () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} />);

    const input = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(onSend).toHaveBeenCalledWith("hello", []);
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

describe("ChatComposer — toolbar: upload gating (env-default-off)", () => {
  it("disables the attach button by default (uploadEnabled unset)", () => {
    render(<ChatComposer onSend={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Attach files" })).toBeDisabled();
  });

  it("disables the attach button when uploadEnabled is explicitly false", () => {
    render(<ChatComposer onSend={vi.fn()} uploadEnabled={false} />);
    expect(screen.getByRole("button", { name: "Attach files" })).toBeDisabled();
  });

  it("enables the attach button when uploadEnabled is true", () => {
    render(<ChatComposer onSend={vi.fn()} uploadEnabled />);
    expect(screen.getByRole("button", { name: "Attach files" })).toBeEnabled();
  });

  it("keeps the attach button disabled when the composer itself is disabled", () => {
    render(<ChatComposer onSend={vi.fn()} uploadEnabled disabled />);
    expect(screen.getByRole("button", { name: "Attach files" })).toBeDisabled();
  });
});

describe("ChatComposer — attachments (T071)", () => {
  it("adds a preview chip for a picked file within the accept/size limits", async () => {
    render(<ChatComposer onSend={vi.fn()} uploadEnabled />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file("cat.png", "image/png")] } });

    await waitFor(() =>
      expect(screen.getByText("cat.png")).toBeInTheDocument(),
    );
  });

  it("shows an inline error and does not attach a rejected file type", async () => {
    render(
      <ChatComposer onSend={vi.fn()} uploadEnabled uploadAccept="image/*" />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [file("report.pdf", "application/pdf")] },
    });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/report\.pdf/));
    expect(screen.queryByText("report.pdf")).toBeNull();
  });

  it("removes a picked attachment via its remove control", async () => {
    render(<ChatComposer onSend={vi.fn()} uploadEnabled />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file("cat.png", "image/png")] } });
    await waitFor(() => expect(screen.getByText("cat.png")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Remove cat.png"));
    expect(screen.queryByText("cat.png")).toBeNull();
  });

  it("sends attachments alongside the text and clears them after send", async () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} uploadEnabled />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file("cat.png", "image/png")] } });
    await waitFor(() => expect(screen.getByText("cat.png")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "look at this" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(onSend).toHaveBeenCalledTimes(1);
    const [text, attachments] = onSend.mock.calls[0];
    expect(text).toBe("look at this");
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({ name: "cat.png", mimeType: "image/png" });
    expect(screen.queryByText("cat.png")).toBeNull();
  });
});

describe("ChatComposer — context-window ring (004)", () => {
  it("shows the ring meter when usage is enabled and a reading is present", () => {
    render(
      <ChatComposer onSend={vi.fn()} usageEnabled contextUsage={contextUsage()} />,
    );
    expect(
      document.querySelector('[data-slot="context-meter"]'),
    ).toBeInTheDocument();
  });

  it("hides the meter when usage is disabled", () => {
    render(
      <ChatComposer
        onSend={vi.fn()}
        usageEnabled={false}
        contextUsage={contextUsage()}
      />,
    );
    expect(document.querySelector('[data-slot="context-meter"]')).toBeNull();
  });

  it("hides the meter when the reading is unknown (no measurable usage)", () => {
    render(
      <ChatComposer
        onSend={vi.fn()}
        usageEnabled
        contextUsage={contextUsage({ level: "unknown", used: 0 })}
      />,
    );
    expect(document.querySelector('[data-slot="context-meter"]')).toBeNull();
  });
});

describe("ChatComposer — /compact via the ring (US2)", () => {
  it("clicking the ring above threshold sends the verbatim /compact turn", () => {
    const onSend = vi.fn();
    render(
      <ChatComposer onSend={onSend} usageEnabled contextUsage={contextUsage()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /compact/i }));
    expect(onSend).toHaveBeenCalledWith("/compact", []);
  });

  it("is not clickable below the compact threshold", () => {
    render(
      <ChatComposer
        onSend={vi.fn()}
        usageEnabled
        contextUsage={contextUsage({ used: 12400 })}
      />,
    );
    expect(screen.queryByRole("button", { name: /compact/i })).toBeNull();
  });

  it("disables the compact click while a generation is busy", () => {
    render(
      <ChatComposer onSend={vi.fn()} usageEnabled contextUsage={contextUsage()} busy />,
    );
    expect(screen.getByRole("button", { name: /compact/i })).toBeDisabled();
  });

  it("prefers an explicit onCompact handler when provided", () => {
    const onCompact = vi.fn();
    const onSend = vi.fn();
    render(
      <ChatComposer
        onSend={onSend}
        onCompact={onCompact}
        usageEnabled
        contextUsage={contextUsage()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /compact/i }));
    expect(onCompact).toHaveBeenCalledOnce();
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe("ChatComposer — slash suggester (US3)", () => {
  const typed = (value: string) => {
    const input = screen.getByLabelText("Message");
    fireEvent.change(input, { target: { value } });
    return input;
  };

  it("opens the menu listing /compact when the input starts with '/'", () => {
    render(<ChatComposer onSend={vi.fn()} messageCount={2} />);
    expect(screen.queryByRole("listbox")).toBeNull();
    typed("/");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /compact/i })).toBeInTheDocument();
  });

  it("opens the menu even on an empty conversation (discoverable before the first turn)", () => {
    render(<ChatComposer onSend={vi.fn()} messageCount={0} />);
    typed("/");
    expect(screen.getByRole("option", { name: /compact/i })).toBeInTheDocument();
  });

  it("filters by prefix and closes when the '/' is removed", () => {
    render(<ChatComposer onSend={vi.fn()} messageCount={2} />);
    typed("/co");
    expect(screen.getByRole("option", { name: /compact/i })).toBeInTheDocument();
    typed("hello");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes once a space is typed — the rest is the command's argument", () => {
    render(<ChatComposer onSend={vi.fn()} messageCount={2} />);
    typed("/compact");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    typed("/compact keep key insights");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("Tab completes the highlighted command into the input (no send)", () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} messageCount={2} />);
    const input = typed("/comp");
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input).toHaveValue("/compact ");
    expect(onSend).not.toHaveBeenCalled();
    // The menu has closed (a space now separates the argument).
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("clicking a command completes it into the input too", () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} messageCount={2} />);
    typed("/");
    fireEvent.mouseDown(screen.getByRole("option", { name: /compact/i }));
    expect(screen.getByLabelText("Message")).toHaveValue("/compact ");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("Enter sends the composed command line, argument and all", () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} messageCount={2} />);
    const input = typed("/compact keep key insights");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("/compact keep key insights", []);
  });

  it("closes on Escape without sending", () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} messageCount={2} />);
    const input = typed("/");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not open the menu for a plain (non-slash) message", () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} messageCount={2} />);
    const input = typed("hello there");
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("hello there", []);
  });

  it("respects IME composition (Tab during isComposing does not complete a command)", () => {
    render(<ChatComposer onSend={vi.fn()} messageCount={2} />);
    const input = typed("/comp");
    fireEvent.keyDown(input, { key: "Tab", isComposing: true });
    expect(input).toHaveValue("/comp");
  });
});

describe("ChatComposer — toolbar: agent dropdown (US5, FR-026)", () => {
  const agents = [
    { id: "a1", name: "Analyst" },
    { id: "a2", name: "Coder" },
  ];

  it("always renders the dropdown, with just a placeholder when no agents are configured", () => {
    render(<ChatComposer onSend={vi.fn()} agents={[]} agentsAvailable={false} />);
    const trigger = screen.getByLabelText("Select agent");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Agent");

    fireEvent.click(trigger);
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("renders the configured agent list when available", () => {
    render(
      <ChatComposer
        onSend={vi.fn()}
        agents={agents}
        agentsAvailable
        selectedAgentId="a1"
      />,
    );
    const trigger = screen.getByLabelText("Select agent");
    expect(trigger).toHaveTextContent("Analyst");

    fireEvent.click(trigger);
    expect(screen.getByRole("option", { name: "Analyst" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Coder" })).toBeInTheDocument();
  });

  it("calls onSelectAgent when a different agent is chosen", () => {
    const onSelectAgent = vi.fn();
    render(
      <ChatComposer
        onSend={vi.fn()}
        agents={agents}
        agentsAvailable
        selectedAgentId="a1"
        onSelectAgent={onSelectAgent}
      />,
    );

    fireEvent.click(screen.getByLabelText("Select agent"));
    fireEvent.click(screen.getByRole("option", { name: "Coder" }));

    expect(onSelectAgent).toHaveBeenCalledWith("a2");
  });
});
