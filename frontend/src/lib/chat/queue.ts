import type { Attachment, QueuedMessage } from "@/entities";

/**
 * Pure send-queue logic (D6). While a generation is active, extra sends are appended
 * to a FIFO queue; on a terminal turn the hook pops the head and dispatches it.
 * Empty / whitespace-only input is never enqueued (FR-002 — no empty bubble/request),
 * even if attachments are present (T071 keeps the existing "must type something" rule
 * — attachments ride along with text, they don't stand alone).
 * No I/O, no mutation.
 */

/** True when `text` is empty or only whitespace (not sendable). */
export function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/** Append sendable `text` (+ optional attachments) under `id` to the queue; blank input
 *  returns the queue unchanged. `id` (caller-supplied, stable) keys the pending bubble. */
export function enqueue(
  queue: QueuedMessage[],
  id: string,
  text: string,
  attachments: Attachment[] = [],
): QueuedMessage[] {
  if (isBlank(text)) return queue;
  return [...queue, { id, text, attachments }];
}

/** Pop the FIFO head. `next` is null when the queue is empty. */
export function dequeue(
  queue: QueuedMessage[],
): { next: QueuedMessage | null; queue: QueuedMessage[] } {
  if (queue.length === 0) return { next: null, queue: [] };
  const [next, ...rest] = queue;
  return { next, queue: rest };
}
