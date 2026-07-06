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
      // No `update.debounce`: on a continuous stream (a token per frame) OS's debounce does
      // NOT smooth — it SAMPLES the scroll size at arbitrary `maxWait` points, so the handle
      // jumps to whatever height existed at each sample. Debounce is for CSS-animation jank
      // (issue #744), not token streaming. The real fix is the content element below.
    },
  });

  React.useEffect(() => {
    const wrap = wrapRef.current;
    const el = wrap?.querySelector<HTMLElement>(
      "[data-slot=message-scroller-viewport]",
    );
    if (!wrap || !el) return;
    // `scrollbars.slot: wrap` mounts the scrollbar in the OUTER wrapper, NOT inside the
    // scrolled element (OS's default when the viewport is the target). Inside the scroller,
    // OS keeps the absolutely-positioned `.os-scrollbar` (≈viewport-tall) glued in place by
    // translating it with `transform: translateY(≈scrollTop)` on every update — and a
    // transformed descendant EXTENDS the scrollable overflow. That is invisible while
    // content only grows, but when a turn SHRINKS (a tool-call group collapses) the stale
    // translated bar keeps scrollHeight pinned at `old scrollTop + viewport height`,
    // leaving real phantom space below the messages — self-sustaining, because OS re-measures
    // the very overflow its own bar creates (it only drains as you scroll up). With the bar
    // outside the scroller, OS skips that translate entirely and the scroller's height is
    // purely its content again. (`elements.content` is NOT used: OS silently ignores it when
    // the viewport is the target, so it can't help here.)
    initialize({
      target: el,
      elements: { viewport: el },
      scrollbars: { slot: wrap },
    });
    return () => getInstance()?.destroy();
  }, [initialize, getInstance]);

  return (
    <div ref={wrapRef} className="relative size-full min-h-0 min-w-0">
      <MessageScrollerPrimitive.Viewport
        data-slot="message-scroller-viewport"
        className={cn(
          // No `scroll-fade-b` here: a bottom mask-image gradient on the viewport fades
          // whatever paints near its bottom edge — it read as a gradient scrollbar handle
          // when the bar lived inside the viewport, and it still dims the last message line.
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
