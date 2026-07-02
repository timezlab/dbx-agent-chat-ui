"use client";

import * as React from "react";

import { resolveConfig } from "@/lib/config";
import { ChatProvider } from "@/components/chat/chat-provider";
import { ChatScreen } from "@/components/chat/chat-screen";
import { ChatToaster } from "@/components/chat/chat-toaster";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

/**
 * The application shell: sidebar chrome + a top bar (collapse trigger, theme quick
 * toggle) wrapped around the chat surface, all under one shared `ChatProvider` so the
 * sidebar and the chat act on the same conversation. Config is resolved once from
 * public env. Static-export-safe: the sidebar defaults open (no server cookie read),
 * `next-themes` is client-only.
 */
export function AppShell() {
  const config = React.useMemo(() => resolveConfig(), []);

  return (
    <ChatProvider config={config}>
      <ChatToaster />
      <TooltipProvider delayDuration={300}>
        <SidebarProvider className="h-dvh min-h-0">
          <AppSidebar config={config} />
          <SidebarInset className="flex min-h-0 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-4">
            <SidebarTrigger className="-ml-1.5 size-8" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4"
            />
            <span className="text-sm font-semibold tracking-tight">Chat</span>
            <ThemeToggle className="ml-auto" />
          </header>
            <ChatScreen className="min-h-0 flex-1" />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ChatProvider>
  );
}

export default AppShell;
