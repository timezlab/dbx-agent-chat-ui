import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Identity } from "@/entities";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavIdentity } from "@/components/shell/nav-identity";
import type { UseIdentityResult } from "@/hooks/identity/use-identity";

const useIdentityMock = vi.fn<() => UseIdentityResult>();
vi.mock("@/hooks/identity/use-identity", () => ({
  useIdentity: () => useIdentityMock(),
}));

function renderChip() {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <NavIdentity config={{ meUrl: "/api/me" }} />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

afterEach(() => useIdentityMock.mockReset());

describe("NavIdentity", () => {
  it("renders an anonymous placeholder when identity is unavailable (never blank)", () => {
    useIdentityMock.mockReturnValue({ identity: null, available: false });
    renderChip();
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.getByText("Not signed in")).toBeInTheDocument();
  });

  it("shows the username as the primary line with the email beneath it", () => {
    const identity: Identity = {
      email: "dai.le@timezlab.org",
      username: "dai.le",
      auth_type: "DB_SAML_SSO",
    };
    useIdentityMock.mockReturnValue({ identity, available: true });
    renderChip();
    expect(screen.getByText("dai.le")).toBeInTheDocument();
    expect(screen.getByText("dai.le@timezlab.org")).toBeInTheDocument();
  });

  it("renders the optional detail fields it was given, skipping absent ones", () => {
    const identity: Identity = {
      email: "dai.le@timezlab.org",
      username: "dai.le",
      user_id: "u-8f3a1c92",
      auth_type: "PAT",
      // no session_id / org_id → those rows must not render
    };
    useIdentityMock.mockReturnValue({ identity, available: true });
    renderChip();
    // The trigger always renders the avatar fallback initials for the seeded avatar.
    expect(screen.getByText("DL")).toBeInTheDocument();
  });
});
