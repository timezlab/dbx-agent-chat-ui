"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  FlaskConicalIcon,
  InfoIcon,
  PlayIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "react-toastify";

import { useChatContext } from "@/components/chat/chat-provider";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";

/** A representative long, server-shaped reason so the persistent error toast can be
 *  eyeballed exactly as a real stream failure would render it. */
const SAMPLE_ERROR =
  "Chat request failed (503): upstream agent endpoint is unavailable — the serving " +
  "cluster returned no healthy replica. This toast does not auto-close so you can read " +
  "the full reason.";

/**
 * Dev/test entry in the sidebar footer (mirrors NavSettings). A dropdown that both:
 *  - toggles **Replay mode** (feature 002) — while on, the chat composer is replaced by
 *    the Replay control that plays a recorded SSE stream client-side; and
 *  - fires sample toasts so the react-toastify setup — especially the *persistent* error
 *    toast used for detailed stream failures (autoClose: false) — can be verified without
 *    a real backend error.
 *
 * Only rendered when the `NEXT_PUBLIC_DEV_TOOLS` flag is enabled (gated by `AppSidebar`,
 * FR-026), so it is absent from customer-facing builds.
 */
export function NavDevTools() {
  const { isMobile } = useSidebar();
  const { replayMode, toggleReplayMode } = useChatContext();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          tooltip="Dev tools"
          isActive={replayMode}
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
        >
          <FlaskConicalIcon />
          <span>Dev tools{replayMode ? " · Replay on" : ""}</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel>Replay</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={replayMode}
          // Radix would close the menu and steal focus on select; keep it open so the
          // toggle reads like a switch.
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() => toggleReplayMode()}
          data-slot="nav-devtools-replay"
        >
          <PlayIcon />
          Replay mode
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Test toasts</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => toast.error(SAMPLE_ERROR, { autoClose: false })}
        >
          <TriangleAlertIcon />
          Error (persistent)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.info("Info toast — auto-closes.")}>
          <InfoIcon />
          Info
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => toast.success("Success toast — auto-closes.")}
        >
          <CheckCircle2Icon />
          Success
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default NavDevTools;
