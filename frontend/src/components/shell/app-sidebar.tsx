"use client";

import * as React from "react";
import { MessageSquareIcon, PlusIcon, BookIcon } from "lucide-react";
import { useOverlayScrollbars } from "overlayscrollbars-react";
import { Logo } from "@/components/logo";

import type { CapabilityConfig } from "@/entities";
import { useChatContext } from "@/components/chat/chat-provider";
import { conversationTitle } from "@/lib/history/summary";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavSettings } from "./nav-settings";
import { NavDevTools } from "./nav-devtools";
import { NavIdentity } from "./nav-identity";

export interface AppSidebarProps {
  config: CapabilityConfig;
}

/**
 * App chrome: brand, a "New chat" action, and the history list. The active conversation
 * sits at the top of the list (highlighted) with any past conversations below it; each
 * past row opens that conversation via `selectConversation`. The list is read from
 * `HistoryProvider` (backend when configured, else localStorage). Collapses to an icon
 * rail; settings live in the footer.
 */
export function AppSidebar({ config }: AppSidebarProps) {
  const { conversation, conversations, newConversation, selectConversation } =
    useChatContext();
  const currentTitle = conversationTitle(conversation);
  const hasTurns = conversation.messages.length > 0;
  // Saved rows keep their natural (newest-first) position; the active one is just
  // highlighted in place — selecting a conversation must NOT hoist it to the top.
  const inList = conversations.some((c) => c.id === conversation.id);
  // A live conversation that isn't saved yet (mid first turn) gets a temporary top row.
  const showCurrentRow = hasTurns && !inList;
  const showHistory = showCurrentRow || conversations.length > 0;

  // Overlay scrollbars on the sidebar's scroll region. SidebarContent lives in
  // `components/ui` (kept pristine) and already hides the native bar (`no-scrollbar`), so we
  // attach OverlayScrollbars to its element by `data-slot` and use it AS the viewport —
  // native scroll preserved, overlay bar drawn on top (themed `os-theme-tz`).
  const [initialize, getInstance] = useOverlayScrollbars({
    defer: true,
    options: {
      scrollbars: { theme: "os-theme-tz", autoHide: "never" },
      overflow: { x: "hidden", y: "scroll" },
    },
  });
  React.useEffect(() => {
    const el = document.querySelector<HTMLElement>(
      '[data-slot="sidebar-content"]',
    );
    if (!el) return;
    initialize({ target: el, elements: { viewport: el, content: false } });
    return () => getInstance()?.destroy();
  }, [initialize, getInstance]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="gap-2.5 [&_svg]:size-8">
              <Logo />
              <span className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">DBX Agent</span>
                <span className="truncate text-xs text-muted-foreground">
                  UI
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="New chat"
                onClick={() => newConversation()}
                className="font-medium"
              >
                <PlusIcon />
                <span>New chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {config.welcomeUrl ? (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Welcome">
                  <a href={config.welcomeUrl}>
                    <BookIcon />
                    <span>Welcome</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
          </SidebarMenu>
        </SidebarGroup>

        {showHistory ? (
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:-mt-10">
              History
            </SidebarGroupLabel>
            <SidebarMenu>
              {showCurrentRow ? (
                <SidebarMenuItem>
                  <SidebarMenuButton isActive tooltip={currentTitle}>
                    <MessageSquareIcon />
                    <span className="truncate">{currentTitle}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {conversations.map((c) => (
                <SidebarMenuItem key={c.id}>
                  <SidebarMenuButton
                    isActive={c.id === conversation.id}
                    tooltip={c.title}
                    onClick={() => selectConversation(c.id)}
                  >
                    <MessageSquareIcon />
                    <span className="truncate">{c.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {config.devToolsEnabled ? (
            <SidebarMenuItem>
              <NavDevTools />
            </SidebarMenuItem>
          ) : null}
          {config.docsUrl ? (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Documentation">
                <a href={config.docsUrl} target="_blank" rel="noopener noreferrer">
                  <BookIcon />
                  <span>Documentation</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <NavSettings config={config} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <NavIdentity config={config} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
