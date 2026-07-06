import type { AxiosInstance } from "axios";

import type { CapabilityConfig, Feedback } from "@/entities";

import { ApiService } from "./base";

/**
 * Feedback capability — per-reply thumbs up/down (+ optional comment).
 * `POST {feedbackUrl}` body `Feedback` → 2xx. Unconfigured ⇒ a no-op (the UI's optimistic
 * selection still works without a backend). A rejected submit throws; the panel surfaces
 * a non-blocking notice and keeps the selection — feedback is never a blocking gate.
 */
export class FeedbackApiService extends ApiService {
  /** Declares its endpoint: `feedbackUrl` from public config (unset ⇒ no-op). */
  constructor(config: CapabilityConfig, client?: AxiosInstance) {
    super(config.feedbackUrl, client);
  }

  async submit(feedback: Feedback): Promise<void> {
    if (!this.configured) return;
    await this.requestVoid(
      { method: "POST", data: feedback },
      "FeedbackApi.submit",
    );
  }
}
