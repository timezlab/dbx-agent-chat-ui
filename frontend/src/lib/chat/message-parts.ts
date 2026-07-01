import type {
  MessagePart,
  ReasoningPart,
  TextPart,
  ToolsPart,
} from "@/entities";

/** A reasoning or tools part — the "work" the agent does between answer text. */
export type ActivityPart = ReasoningPart | ToolsPart;

/**
 * A rendered segment of an assistant turn: either a visible answer `text`, or a run
 * of consecutive `reasoning`/`tools` parts folded into ONE collapsible "process"
 * group (claude.ai-style) so a long tool run doesn't stretch the transcript.
 */
export type PartSegment =
  | { kind: "text"; index: number; part: TextPart }
  | { kind: "activity"; index: number; parts: ActivityPart[] };

/**
 * Fold `Message.parts[]` into render segments, coalescing each maximal run of
 * consecutive non-text parts (reasoning + tools) into a single `activity` segment
 * while keeping `text` parts standalone and in stream order. `index` is the part
 * index where the segment starts — a stable React key and the anchor used to tell
 * whether the segment is the streaming tail.
 */
export function groupMessageParts(parts: MessagePart[]): PartSegment[] {
  const segments: PartSegment[] = [];
  parts.forEach((part, index) => {
    if (part.type === "text") {
      segments.push({ kind: "text", index, part });
      return;
    }
    const last = segments[segments.length - 1];
    if (last && last.kind === "activity") {
      last.parts.push(part);
    } else {
      segments.push({ kind: "activity", index, parts: [part] });
    }
  });
  return segments;
}
