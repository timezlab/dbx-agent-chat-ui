"use client";

import { ChevronsUpDownIcon } from "lucide-react";

import type { CapabilityConfig, Identity } from "@/entities";
import { useIdentity } from "@/hooks/identity/use-identity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";

export interface NavIdentityProps {
  /** Public config; used to resolve the identity client from `meUrl`. */
  config: CapabilityConfig;
}

/** The optional identity fields, in display order, with human labels. */
const DETAIL_ROWS: Array<{ key: keyof Identity; label: string }> = [
  { key: "user_id", label: "User ID" },
  { key: "session_id", label: "Session ID" },
  { key: "auth_type", label: "Auth type" },
  { key: "org_id", label: "Org ID" },
];

/**
 * What the chip actually renders. Derived from a real `Identity` when available, or a
 * fixed anonymous placeholder otherwise (never a blank footer — the chip always shows).
 */
interface ChipView {
  name: string;
  email: string;
  seed: string;
  initials: string;
  rows: Array<{ label: string; value: string }>;
}

/** Up-to-two-letter fallback shown until (or if) the avatar image fails to load. */
function initialsOf(base: string): string {
  const parts = base.split(/[.\-_\s@]+/).filter(Boolean);
  const letters =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Deterministic avatar rendered from a stable seed via DiceBear — no upload, no stored
 * asset, same face every session. A plain SVG `<img>` (Radix Avatar), so it needs no Next
 * image config and degrades to the initials fallback if the fetch fails.
 */
function avatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

/** The anonymous placeholder shown when no identity is available. */
const ANONYMOUS_VIEW: ChipView = {
  name: "Anonymous",
  email: "Not signed in",
  seed: "anonymous",
  initials: "AN",
  rows: [],
};

function toView(identity: Identity): ChipView {
  return {
    name: identity.username,
    email: identity.email,
    seed: identity.username,
    initials: initialsOf(identity.username || identity.email),
    rows: DETAIL_ROWS.filter(({ key }) => identity[key]).map(({ key, label }) => ({
      label,
      value: String(identity[key]),
    })),
  };
}

/**
 * Identity chip at the very bottom of the sidebar footer (shadcn `NavUser` shape): a
 * seeded avatar, username + email, and a dropdown that repeats the header and lists
 * whatever optional fields the `me` endpoint returned (user_id / session_id / auth_type /
 * org_id). When no `meUrl` is configured, the fetch failed, or the payload was invalid
 * (`available: false`), it renders a fixed **anonymous** placeholder rather than
 * disappearing — the footer chip is always present. Read-only, display-only.
 */
export function NavIdentity({ config }: NavIdentityProps) {
  const { isMobile } = useSidebar();
  const { identity, available } = useIdentity({ config });

  const view = available && identity ? toView(identity) : ANONYMOUS_VIEW;
  const { name, email, seed, initials, rows } = view;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          tooltip={email}
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar className="size-8 rounded-lg">
            <AvatarImage src={avatarUrl(seed)} alt={name} />
            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {email}
            </span>
          </div>
          <ChevronsUpDownIcon className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8 rounded-lg">
              <AvatarImage src={avatarUrl(seed)} alt={name} />
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        {rows.length > 0 ? <DropdownMenuSeparator /> : null}
        {rows.map(({ label, value }) => (
          <IdentityRow key={label} label={label} value={value} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-mono" title={value}>
        {value}
      </span>
    </div>
  );
}

export default NavIdentity;
