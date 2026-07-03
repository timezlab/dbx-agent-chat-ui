import * as React from "react";

import { cn } from "@/lib/utils";

/** Shared list wrapper for source-style cards (web_search sources, vector_search chunks). */
export function SourceCardList({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col gap-2 py-0.5">{children}</ul>;
}

/**
 * A single source card, shared by web_search results and vector_search chunks.
 * Row 1: icon + title (left) + optional trailing accessory (domain / score badge).
 * Row 2: an optional snippet, clamped. Renders as an external link when `href` is set,
 * otherwise a plain card.
 */
export function SourceCard({
  href,
  icon,
  title,
  trailing,
  snippet,
  clamp = 2,
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
  snippet?: string | null;
  clamp?: 2 | 3;
}) {
  const body = (
    <>
      {/* Row 1: icon · title · trailing */}
      <span className="flex items-center gap-2">
        {icon}
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {title}
        </span>
        {trailing}
      </span>
      {/* Row 2: snippet */}
      {snippet ? (
        <span
          className={cn(
            "mt-1 text-[11px] leading-snug text-muted-foreground",
            clamp === 3 ? "line-clamp-3" : "line-clamp-2",
          )}
        >
          {snippet}
        </span>
      ) : null}
    </>
  );

  const base =
    "flex flex-col gap-1 rounded-lg border border-border/60 bg-card px-2.5 py-2";
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(base, "transition-colors hover:border-border")}
    >
      {body}
    </a>
  ) : (
    <div className={base}>{body}</div>
  );
}
