"use client";

import * as React from "react";
import { MessageScroller as MessageScrollerPrimitive } from "@shadcn/react/message-scroller";
import { useOverlayScrollbars } from "overlayscrollbars-react";

import { cn } from "@/lib/utils";

/**
 * Custom message viewport (kept out of `components/ui` so the shadcn primitive stays
 * pristine). Overlay scrollbars via OverlayScrollbars: the native bar is hidden — so it
 * reserves NO layout width and the centered message column sits on the same axis as the
 * composer — and a thin, auto-hiding themed bar is drawn on top instead.
 *
 * OverlayScrollbars is initialized with the primitive's own Viewport element AS the
 * `viewport` (and no generated content wrapper), so native scrolling — and the auto-scroll
 * primitive's `scrollTo` — keep working untouched. We locate the element by querying it out
 * of a wrapper rather than passing a `ref`, to avoid clobbering the ref the primitive uses
 * internally.
 */
export function MessageViewport({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [initialize, getInstance] = useOverlayScrollbars({
    defer: true,
    options: {
      // "never" ⇒ OS keeps the bar permanently visible (never auto-hides when idle). The
      // dim-idle / bright-on-hover two-state comes from the handle color alone (os-theme-tz).
      scrollbars: { theme: "os-theme-tz", autoHide: "never" },
      overflow: { x: "hidden", y: "scroll" },
    },
  });

  React.useEffect(() => {
    const el = wrapRef.current?.querySelector<HTMLElement>(
      "[data-slot=message-scroller-viewport]",
    );
    if (!el) return;
    initialize({ target: el, elements: { viewport: el, content: false } });
    return () => getInstance()?.destroy();
  }, [initialize, getInstance]);

  return (
    <div ref={wrapRef} className="relative size-full min-h-0 min-w-0">
      <MessageScrollerPrimitive.Viewport
        data-slot="message-scroller-viewport"
        className={cn(
          // No `scroll-fade-b` here: it applies a bottom mask-image gradient to the whole
          // viewport, and since OverlayScrollbars mounts the bar INSIDE the viewport, the
          // mask fades the scrollbar too (it looks like a gradient handle).
          "size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain contain-content",
          className,
        )}
        {...props}
      >
        {children}
      </MessageScrollerPrimitive.Viewport>
    </div>
  );
}
