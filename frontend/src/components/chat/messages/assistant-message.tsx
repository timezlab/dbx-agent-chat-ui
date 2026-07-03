import * as React from "react";

import { Streamdown, type BundledTheme } from "streamdown";

import type { Feedback, Message } from "@/entities";
import { cn } from "@/lib/utils";
import { groupMessageParts } from "@/lib/chat/message-parts";
import { resolveReferenceLinks } from "@/lib/markdown/reference-links";
import { splitDataImages } from "@/lib/markdown/data-images";
import {
  Message as MessageRow,
  MessageContent,
} from "@/components/ui/message";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityGroup } from "../activity-group";
import { StreamError } from "../stream-error";
import { FeedbackPanel } from "../feedback-panel";
import { LinkSafetyModal } from "../link-safety-modal";
import { useOverlayTables } from "./use-overlay-tables";

export interface AssistantMessageProps extends React.ComponentProps<"div"> {
  message: Message;
  /** Submit feedback for this reply; omitted ⇒ the feedback panel is hidden. */
  onFeedback?: (feedback: Feedback) => void | Promise<void>;
  /**
   * Call id of the first `write_todos` in the whole conversation, so its tool row
   * reads "Create plan" while later ones read "Update plan" (threaded from the list).
   */
  firstPlanCallId?: string | null;
}

/** Shiki themes for streamed code blocks (light, dark) — flip with the app theme. */
const SHIKI_THEME: [BundledTheme, BundledTheme] = ["github-light", "github-dark"];

/** External-link confirmation, portaled to the viewport (see link-safety-modal). */
const LINK_SAFETY = {
  enabled: true,
  renderModal: (props: React.ComponentProps<typeof LinkSafetyModal>) => (
    <LinkSafetyModal {...props} />
  ),
};

/**
 * An assistant turn. A column that walks `Message.parts[]` in stream
 * order (FR-003/FR-004/FR-005) after folding each consecutive reasoning+tools run into
 * ONE collapsible "process" group (groupMessageParts) so a long tool run stays compact:
 * `text` → markdown/code via `streamdown` (animating caret while streaming); an
 * `activity` group → the folded process dropdown, open + live while it is the streaming
 * tail and auto-collapsing when the answer starts. An error frame renders inline below
 * the partial output (FR-009); a settled turn shows the feedback panel.
 */
export function AssistantMessage({
  message,
  onFeedback,
  firstPlanCallId,
  className,
  ...props
}: AssistantMessageProps) {
  const streaming = message.status === "streaming";
  const segments = groupMessageParts(message.parts);
  const lastSegment = segments.length - 1;
  const hasVisible = message.parts.some(
    (p) =>
      (p.type === "text" && p.text.length > 0) ||
      (p.type === "reasoning" && p.text.length > 0) ||
      (p.type === "tools" && p.items.length > 0),
  );
  const showFeedback = onFeedback != null && !streaming && hasVisible;

  // Overlay scrollbars on any markdown table Streamdown renders in this turn (see hook).
  const contentRef = React.useRef<HTMLDivElement>(null);
  useOverlayTables(contentRef);

  return (
    <MessageRow
      align="start"
      data-slot="assistant-message"
      data-status={message.status}
      className={cn(className)}
      {...props}
    >
      <MessageContent ref={contentRef}>
        {segments.map((segment, i) => {
          if (segment.kind === "text") {
            // Base64 images an agent streams are rendered by us (see renderTextSegment) —
            // Streamdown blocks `data:` image URIs and offers no opt-in prop.
            const blocks = splitDataImages(resolveReferenceLinks(segment.part.text));
            const lastMd = blocks.map((b) => b.type).lastIndexOf("md");
            return (
              <React.Fragment key={`t${segment.index}`}>
                {blocks.map((block, bi) =>
                  block.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`t${segment.index}-${bi}`}
                      data-slot="assistant-image"
                      src={block.src}
                      alt={block.alt}
                      className="my-4 max-w-full rounded-lg border border-foreground/10"
                    />
                  ) : block.text.trim().length === 0 ? null : (
                    <Streamdown
                      // Remount once streaming settles: Streamdown caches parsed blocks
                      // across incremental frames, and resolveReferenceLinks rewrites block
                      // structure late in the stream (strips `[x]: url` definitions, inlines
                      // the links) — leaving stale blocks that still show raw `[text][ref]`.
                      // Flipping the key on settle forces a clean re-parse (matches reload).
                      key={`t${segment.index}-${bi}-${streaming ? "live" : "final"}`}
                      data-slot="assistant-markdown"
                      shikiTheme={SHIKI_THEME}
                      linkSafety={LINK_SAFETY}
                      isAnimating={streaming && i === lastSegment && bi === lastMd}
                      className="min-w-0 animate-in fade-in-0 slide-in-from-bottom-1 text-sm leading-relaxed duration-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:list-disc [&_ul]:list-outside [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:list-outside [&_ol]:pl-6"
                    >
                      {block.text}
                    </Streamdown>
                  ),
                )}
              </React.Fragment>
            );
          }
          // An activity group is "active" (open + live) only while it is the
          // streaming tail — once answer text follows it, it auto-collapses.
          return (
            <ActivityGroup
              key={`a${segment.index}`}
              parts={segment.parts}
              active={streaming && i === lastSegment}
              firstPlanCallId={firstPlanCallId}
            />
          );
        })}

        {streaming && !hasVisible ? (
          // Before the first token/tool arrives, show a skeleton placeholder (pulsing
          // lines) at the bottom so the turn reads as "loading", not empty. Replaced by
          // the streamed content — or its own caret — the moment anything is visible.
          <div
            data-slot="assistant-skeleton"
            role="status"
            aria-label="Assistant is responding"
            className="flex w-full flex-col gap-2 py-0.5 animate-in fade-in-0 duration-300"
          >
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        ) : null}

        {streaming && hasVisible ? (
          // Content is already flowing but the turn hasn't settled — a bouncing-dots
          // indicator at the bottom signals "still generating" (distinct from the
          // pre-first-event skeleton above). The three dots pulse out of phase.
          <div
            data-slot="assistant-generating"
            role="status"
            aria-label="Assistant is generating"
            className="flex items-center gap-1 py-1"
          >
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
          </div>
        ) : null}

        {message.error ? <StreamError message={message.error} /> : null}

        {showFeedback ? (
          <FeedbackPanel
            messageId={message.id}
            value={message.feedback?.rating ?? null}
            comment={message.feedback?.comment}
            onSubmit={onFeedback}
            className="mt-1"
          />
        ) : null}
      </MessageContent>
    </MessageRow>
  );
}

export default AssistantMessage;
