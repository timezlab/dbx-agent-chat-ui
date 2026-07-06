import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";

import type { Feedback } from "@/entities";
import { FeedbackApiService } from "@/lib/api/feedback";

function client(): AxiosInstance {
  return {
    request: vi.fn(async () => ({ data: undefined })),
  } as unknown as AxiosInstance;
}

const feedback: Feedback = { messageId: "m1", rating: "up", comment: "nice" };

describe("FeedbackApiService", () => {
  it("submit POSTs the feedback as the request body", async () => {
    const c = client();
    const api = new FeedbackApiService({ feedbackUrl: "https://f" }, c);
    await api.submit(feedback);
    expect(c.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", data: feedback }),
    );
  });

  it("submit is a no-op (no request) when unconfigured", async () => {
    const c = client();
    const api = new FeedbackApiService({}, c);
    await api.submit(feedback);
    expect(c.request).not.toHaveBeenCalled();
  });
});
