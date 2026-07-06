"use client";

import { useEffect, useMemo } from "react";
import { MessageSquareIcon, PlusIcon, BookIcon } from "lucide-react";
import InfiniteScroll from "react-infinite-scroll-component";
import { useOverlayScrollbars } from "overlayscrollbars-react";
import { Logo } from "@/components/logo";
import { OverlayScroll } from "@/components/overlay-scroll";

import type { CapabilityConfig, ConversationSummary } from "@/entities";
import { useChatContext } from "@/components/chat/chat-provider";
import { useConversationsInfinite } from "@/hooks/chat/use-history";
import { conversationTitle } from "@/lib/api/history";
import { Skeleton } from "@/components/ui/skeleton";
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

/** Id of the history scroll region — the InfiniteScroll target. Only THIS element
 * scrolls (the rest of the sidebar stays fixed), so the scroll area is bounded to
 * the list instead of the whole sidebar. */
const HISTORY_SCROLL_ID = "app-history-scroll";

/** Coarse recency buckets, newest-first — mirrors a familiar chat-history sidebar. */
const GROUP_ORDER = [
  "today",
  "yesterday",
  "last7Days",
  "last30Days",
  "older",
] as const;
type GroupKey = (typeof GROUP_ORDER)[number];

const GROUP_LABEL: Record<GroupKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7Days: "Previous 7 days",
  last30Days: "Previous 30 days",
  older: "Older",
};

const DAY_MS = 86_400_000;

/**
 * Bucket summaries by `updatedAt` (epoch ms) into recency groups. Items arrive
 * newest-first from the backend, so each bucket stays newest-first too.
 */
function groupByUpdatedAt(
  items: ConversationSummary[],
): Record<GroupKey, ConversationSummary[]> {
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterday = today - DAY_MS;
  const last7 = today - 7 * DAY_MS;
  const last30 = today - 30 * DAY_MS;

  const grouped: Record<GroupKey, ConversationSummary[]> = {
    today: [],
    yesterday: [],
    last7Days: [],
    last30Days: [],
    older: [],
  };
  for (const c of items) {
    const t = c.updatedAt;
    if (t >= today) grouped.today.push(c);
    else if (t >= yesterday) grouped.yesterday.push(c);
    else if (t >= last7) grouped.last7Days.push(c);
    else if (t >= last30) grouped.last30Days.push(c);
    else grouped.older.push(c);
  }
  return grouped;
}

/**
 * App chrome: brand, a "New chat" action, and the history list. The active conversation
 * is highlighted in place; each past row opens that conversation via `selectConversation`.
 * The list is read from the backend via `useConversationsInfinite` (paginated, page-by-page
 * infinite scroll); when no history backend is configured it is simply empty (no
 * localStorage). Collapses to an icon rail; settings live in the footer.
 *
 * Layout: the history list is its OWN bounded scroll region (`OverlayScroll`, flex-1 within
 * a `min-h-0` group), so ONLY the list scrolls once it outgrows the space — the New chat
 * action above and the footer below stay fixed. Rows are bucketed by recency; page loads
 * and pagination show Skeletons.
 */
export function AppSidebar({ config }: AppSidebarProps) {
  const { conversation, newConversation, selectConversation } =
    useChatContext();
  // Sidebar history list — paginated, backend-owned, page-by-page infinite scroll.
  // Empty (no fetch) when `historyUrl` is unset; there is no local fallback.
  const { conversations, fetchNextPage, hasNextPage, isLoading } =
    useConversationsInfinite({ config });
  const currentTitle = conversationTitle(conversation);
  const hasTurns = conversation.messages.length > 0;
  // Saved rows keep their natural (newest-first) position; the active one is just
  // highlighted in place — selecting a conversation must NOT hoist it to the top.
  const inList = conversations.some((c) => c.id === conversation.id);
  // A live conversation that isn't saved yet (mid first turn) gets a temporary top row.
  const showCurrentRow = hasTurns && !inList;
  const showHistory = showCurrentRow || conversations.length > 0 || isLoading;

  const grouped = useMemo(
    () => groupByUpdatedAt(conversations),
    [conversations],
  );

  // Overlay scrollbar on the SidebarContent viewport itself — the fallback scroll for a
  // short viewport. The history list is height-capped and scrolls internally in the common
  // case, but when the window is too short for even its `min-h` floor, the whole sidebar
  // must scroll (with a visible bar) instead of squishing the history away. SidebarContent
  // lives in `components/ui` (kept pristine) and hides its native bar, so we attach
  // OverlayScrollbars to its element by `data-slot` and use it AS the viewport.
  const [initSidebarScroll, getSidebarScroll] = useOverlayScrollbars({
    defer: true,
    options: {
      scrollbars: { theme: "os-theme-tz", autoHide: "never" },
      overflow: { x: "hidden", y: "scroll" },
    },
  });
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(
      '[data-slot="sidebar-content"]',
    );
    if (!el) return;
    // Viewport = the element itself (`elements.content` would be silently ignored in this
    // mode — see `overlay-scroll.tsx` for the mode's shrink caveat). This is a rarely-
    // scrolled fallback region, so that caveat is acceptable here.
    initSidebarScroll({
      target: el,
      elements: { viewport: el },
    });
    return () => getSidebarScroll()?.destroy();
  }, [initSidebarScroll, getSidebarScroll]);

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
        {/* Fixed actions — sit above the history list. */}
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
          // Hidden entirely in the collapsed icon rail.
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>History</SidebarGroupLabel>
            {/* Bounded scroll container (overlay scrollbars), lakemind-style: grows with its
                rows up to a viewport-relative cap, then ONLY this list scrolls (not the whole
                sidebar). It does NOT flex-shrink — a `flex-1` history collapses to nothing on
                a short viewport because SidebarContent's `overflow` zeroes a flex child's min
                size. Instead `min-h-32` is a hard floor: when the window is too short, the
                list stays 8rem and the SidebarContent overlay scroll (above) takes over. The
                ~20rem offset ≈ header + New chat + label + footer; being off just shifts which
                scroll (inner list vs outer sidebar) engages, never breaks the layout. The
                overlay bar sits above row hover fills via its z-index in `globals.css`. */}
            <OverlayScroll
              id={HISTORY_SCROLL_ID}
              className="min-h-32 max-h-[calc(100dvh-24rem)] px-2"
            >
              {showCurrentRow ? (
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive tooltip={currentTitle}>
                      <MessageSquareIcon />
                      <span className="truncate">{currentTitle}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              ) : null}

              {isLoading && conversations.length === 0 ? (
                <HistorySkeleton />
              ) : (
                <InfiniteScroll
                  dataLength={conversations.length}
                  next={fetchNextPage}
                  hasMore={hasNextPage}
                  scrollableTarget={HISTORY_SCROLL_ID}
                  style={{ overflow: "visible" }}
                  loader={<HistorySkeleton count={2} />}
                >
                  {GROUP_ORDER.map((key) =>
                    grouped[key].length > 0 ? (
                      <div key={key} className="mb-1">
                        <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground/70">
                          {GROUP_LABEL[key]}
                        </div>
                        <SidebarMenu>
                          {grouped[key].map((c) => (
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
                      </div>
                    ) : null,
                  )}
                </InfiniteScroll>
              )}
            </OverlayScroll>
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
                <a
                  href={config.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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

/** Placeholder rows for the initial load and for each appended page — shaped like the real
 * item rows (icon + full-width title) so the list doesn't visibly jump when data lands. */
function HistorySkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="group-data-[collapsible=icon]:hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="size-4 shrink-0 rounded-sm" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export default AppSidebar;
