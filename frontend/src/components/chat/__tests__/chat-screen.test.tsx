import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { CapabilityConfig } from "@/entities";
import { ChatProvider } from "@/components/chat/chat-provider";
import { ChatScreen } from "@/components/chat/chat-screen";

/** ChatScreen reads shared state from context — render it under a provider. The
 * ChatProvider now uses TanStack Query (history), so wrap in a QueryClientProvider. */
function renderScreen(config: CapabilityConfig) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChatProvider config={config}>
        <ChatScreen />
      </ChatProvider>
    </QueryClientProvider>,
  );
}

describe("ChatScreen composition (US1 / T055)", () => {
  it("shows a non-crashing inline notice and disables input when no endpoint is set", () => {
    const config: CapabilityConfig = {}; // chatEndpointUrl unset
    renderScreen(config);

    const notice = screen.getByRole("alert");
    expect(notice).toHaveAttribute("data-slot", "chat-config-notice");
    expect(notice.textContent).toMatch(/NEXT_PUBLIC_CHAT_ENDPOINT_URL/);
    expect(screen.getByLabelText("Message")).toBeDisabled();
  });

  it("renders the composer with no notice when an endpoint is configured", () => {
    const config: CapabilityConfig = {
      chatEndpointUrl: "https://agent.example/invocations",
    };
    renderScreen(config);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Message")).not.toBeDisabled();
    // Send is disabled until non-blank text is entered.
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });
});
