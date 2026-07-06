"use client";

import * as React from "react";
import { useOverlayScrollbars } from "overlayscrollbars-react";

import { cn } from "@/lib/utils";

type Axis = "y" | "x" | "both";

/**
 * Reusable overlay-scroll container. OverlayScrollbars is initialized ON the rendered
 * element itself (viewport = self, no generated content wrapper), so it stays a normal
 * scroll container — native scrolling preserved, children stay direct children (flex/grid
 * layouts intact) — while the native bar is hidden and the themed overlay bar
 * (`os-theme-tz`) is drawn on top. Overlay bars reserve NO layout width, so a centered
 * child stays centered. Drop-in replacement for a raw `overflow-*` element.
 *
 * Prefer this for singleton chrome regions. For many-instance content blocks (per-message
 * tables, code blocks) the themed native scrollbar in globals.css is lighter — don't spin
 * up an OverlayScrollbars instance per block.
 */
export function OverlayScroll({
  axis = "y",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { axis?: Axis }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [initialize, getInstance] = useOverlayScrollbars({
    defer: true,
    options: {
      scrollbars: { theme: "os-theme-tz", autoHide: "never" },
      overflow: {
        x: axis === "y" ? "hidden" : "scroll",
        y: axis === "x" ? "hidden" : "scroll",
      },
    },
  });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Viewport = the element itself; OS silently ignores `elements.content` in this mode, so
    // don't pass it. Known limit (see docs/tech-debt-tracker.md): in this mode OS mounts the
    // bar INSIDE the scroller and keeps it in place with `translateY(≈scrollTop)`, and that
    // transformed bar extends the scrollable overflow — so content that SHRINKS while
    // scrolled leaves phantom scroll space until the user scrolls up. Fine here because
    // every consumer's content only grows or is static; the message viewport (where turns
    // do shrink) mounts the bar outside via `scrollbars.slot` instead.
    initialize({ target: el, elements: { viewport: el } });
    return () => getInstance()?.destroy();
  }, [initialize, getInstance]);

  return (
    <div ref={ref} className={cn(className)} {...props}>
      {children}
    </div>
  );
}
