import type { Feedback } from "@/entities";

import type { FeedbackSink } from "./sink";

/**
 * No-op/local feedback sink used when no feedback URL is configured (FR-021, D10).
 * It accepts and discards submissions so the UI's optimistic selection works without
 * a backend. An optional `onSubmit` lets a host observe locally (e.g. dev logging).
 */
export function createMockFeedback(
  onSubmit?: (feedback: Feedback) => void,
): FeedbackSink {
  return {
    async submit(feedback: Feedback): Promise<void> {
      onSubmit?.(feedback);
    },
  };
}
