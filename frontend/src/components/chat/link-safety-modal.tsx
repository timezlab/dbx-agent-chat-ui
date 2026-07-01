"use client";

import * as React from "react";
import { ExternalLinkIcon } from "lucide-react";
import type { LinkSafetyModalProps } from "streamdown";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Streamdown's built-in link-safety modal is `position: fixed` but is NOT portaled —
 * it renders inline inside the message stream. Our scroll viewport uses CSS
 * containment (`content-visibility` / `contain`), which makes any ancestor a
 * containing block for `fixed` descendants, so the stock modal ends up centered on
 * the message column (often off-screen, requiring a scroll-up) instead of the
 * viewport. Rendering it through Radix's portal escapes the containment and centers
 * it on the real viewport. Passed to `<Streamdown linkSafety={{ renderModal }} />`.
 */
export function LinkSafetyModal({
  isOpen,
  onClose,
  onConfirm,
  url,
}: LinkSafetyModalProps) {
  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
            Open external link?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This link leaves the app. Continue only if you trust the destination:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-all text-foreground/80">
          {url}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Open link</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default LinkSafetyModal;
