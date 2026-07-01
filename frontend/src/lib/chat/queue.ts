/**
 * Pure send-queue logic (D6). While a generation is active, extra sends are appended
 * to a FIFO queue; on a terminal turn the hook pops the head and dispatches it.
 * Empty / whitespace-only input is never enqueued (FR-002 — no empty bubble/request).
 * No I/O, no mutation.
 */

/** True when `text` is empty or only whitespace (not sendable). */
export function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/** Append sendable `text` to the queue; blank input returns the queue unchanged. */
export function enqueue(queue: string[], text: string): string[] {
  if (isBlank(text)) return queue;
  return [...queue, text];
}

/** Pop the FIFO head. `next` is null when the queue is empty. */
export function dequeue(queue: string[]): { next: string | null; queue: string[] } {
  if (queue.length === 0) return { next: null, queue: [] };
  const [next, ...rest] = queue;
  return { next, queue: rest };
}
