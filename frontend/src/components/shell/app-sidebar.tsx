"use client";

import { MessageSquareIcon, PlusIcon } from "lucide-react";
import { Logo } from "@/components/logo";

import type { CapabilityConfig, Conversation } from "@/entities";
import { useChatContext } from "@/components/chat/chat-provider";
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

export interface AppSidebarProps {
  config: CapabilityConfig;
}

/** First user line → conversation label; empty session → "New chat". */
function conversationTitle(conversation: Conversation): string {
  const firstUser = conversation.messages.find((m) => m.role === "user");
  const text = firstUser?.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
  if (!text) return "New chat";
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

/**
 * App chrome: brand, a "New chat" action, and the active conversation. Only the
 * single persisted conversation is shown — a multi-conversation history list is a
 * deferred non-goal (needs a backend list API; `HistoryProvider` persists one
 * conversation). Collapses to an icon rail; settings live in the footer.
 */
export function AppSidebar({ config }: AppSidebarProps) {
  const { conversation, newConversation } = useChatContext();
  const title = conversationTitle(conversation);
  const hasTurns = conversation.messages.length > 0;

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
          </SidebarMenu>
        </SidebarGroup>

        {hasTurns ? (
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:-mt-10">
              Conversation
            </SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive tooltip={title}>
                  <MessageSquareIcon />
                  <span className="truncate">{title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <NavSettings config={config} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
