import type { Feedback } from "@/entities";

import type { FeedbackSink } from "./sink";

/**
 * Remote feedback sink (providers.md): `POST {url}` body `Feedback` → `2xx`. A non-2xx
 * or network error rejects, letting the caller surface a non-blocking notice while
 * retaining the selection (edge case). No bundled secret — auth (if any) is same-origin
 * cookies via `credentials: "include"` (Principle II).
 */
export function createRemoteFeedback(
  url: string,
  fetchImpl?: typeof fetch,
): FeedbackSink {
  const doFetch = fetchImpl ?? globalThis.fetch;
  return {
    async submit(feedback: Feedback): Promise<void> {
      const response = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(feedback),
      });
      if (!response.ok) {
        throw new Error(`Feedback submit failed (${response.status})`);
      }
    },
  };
}
