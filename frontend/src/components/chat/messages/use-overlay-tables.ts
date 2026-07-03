"use client";

import * as React from "react";
import { OverlayScrollbars } from "overlayscrollbars";

/**
 * Overlay-scrollbar options for Streamdown tables: horizontal-only, themed, always visible
 * (`autoHide: "never"` — same `os-theme-tz` as the message/sidebar bars).
 */
const TABLE_OS_OPTIONS = {
  scrollbars: { theme: "os-theme-tz", autoHide: "never" },
  overflow: { x: "scroll", y: "hidden" },
} as const;

/** Streamdown marks its table element; its parent `div` is the horizontal scroll box. */
const TABLE_SELECTOR = 'table[data-streamdown="table"]';

/**
 * Attach themed overlay scrollbars to every Streamdown table wrapper inside `ref`.
 *
 * Streamdown wraps each markdown table in `div.overflow-x-auto.overflow-y-auto` (with a
 * sibling copy/download control bar outside it) and re-renders the table as rows stream in,
 * so we (a) init on mount, (b) rescan on DOM mutations, and (c) skip wrappers already
 * initialized. OS is attached with the wrapper AS its own viewport (`content: false`), so it
 * does NOT restructure the DOM — React keeps patching the streamed `<table>` freely, and
 * Streamdown's own control bar (a sibling, untouched) survives.
 */
export function useOverlayTables(ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const attach = () => {
      root.querySelectorAll<HTMLElement>(TABLE_SELECTOR).forEach((table) => {
        const wrap = table.parentElement;
        // `OverlayScrollbars(el)` with no options is the getter — skip if already attached.
        if (!wrap || OverlayScrollbars(wrap)) return;
        OverlayScrollbars(
          { target: wrap, elements: { viewport: wrap, content: false } },
          TABLE_OS_OPTIONS,
        );
      });
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      root.querySelectorAll<HTMLElement>(TABLE_SELECTOR).forEach((table) => {
        if (table.parentElement) OverlayScrollbars(table.parentElement)?.destroy();
      });
    };
  }, [ref]);
}
