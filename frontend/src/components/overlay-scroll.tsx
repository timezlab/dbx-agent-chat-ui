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
    initialize({ target: el, elements: { viewport: el, content: false } });
    return () => getInstance()?.destroy();
  }, [initialize, getInstance]);

  return (
    <div ref={ref} className={cn(className)} {...props}>
      {children}
    </div>
  );
}
