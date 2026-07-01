import type { CapabilityConfig, Feedback } from "@/entities";

import { createMockFeedback } from "./mock";
import { createRemoteFeedback } from "./remote";

/** Feedback submission port: remote POST when configured, else a no-op mock (D10). */
export interface FeedbackSink {
  submit(feedback: Feedback): Promise<void>;
}

/** Seams for tests — swap the concrete remote/mock sinks. */
export interface ResolveFeedbackDeps {
  makeRemote?: (url: string) => FeedbackSink;
  makeMock?: () => FeedbackSink;
}

/**
 * Resolve the feedback sink from public config (D10): remote when `feedbackUrl` is set,
 * else the no-op/local mock. Submission is non-blocking for the UI — a rejected remote
 * submit surfaces a notice and retains the selection (handled by the feedback panel).
 */
export function resolveFeedback(
  config: CapabilityConfig,
  deps: ResolveFeedbackDeps = {},
): FeedbackSink {
  const makeMock = deps.makeMock ?? (() => createMockFeedback());
  const makeRemote =
    deps.makeRemote ?? ((url: string) => createRemoteFeedback(url));
  return config.feedbackUrl ? makeRemote(config.feedbackUrl) : makeMock();
}
