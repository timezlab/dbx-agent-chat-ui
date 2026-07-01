"use client";

import * as React from "react";
import {
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

import type { CapabilityConfig } from "@/entities";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";

export interface NavSettingsProps {
  /** Public config, for the read-only endpoint/agent status rows. */
  config: CapabilityConfig;
}

/** Truncate a URL to origin + short path so it fits the menu without wrapping. */
function shortUrl(url: string | undefined): string {
  if (!url) return "not set";
  try {
    const u = new URL(url, "http://x");
    return u.host ? `${u.host}${u.pathname}` : url;
  } catch {
    return url;
  }
}

/**
 * Settings entry in the sidebar footer: a dropdown exposing Appearance
 * (light/dark/system → `next-themes`) plus read-only endpoint/agent status. Runtime
 * agent selection (US5) will slot in here once the agents client lands.
 */
export function NavSettings({ config }: NavSettingsProps) {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          tooltip="Settings"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <SettingsIcon />
          <span>Settings</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-60 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <SunIcon />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Endpoint</DropdownMenuLabel>
        <StatusRow label="Chat" value={shortUrl(config.chatEndpointUrl)} />
        <StatusRow
          label="Agents"
          value={config.agentsUrl ? shortUrl(config.agentsUrl) : "default"}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn("truncate font-mono", value === "not set" && "text-destructive")}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

export default NavSettings;
