import { describe, expect, it, vi } from "vitest";

import type { Feedback } from "@/entities";
import { resolveFeedback } from "@/lib/feedback/sink";
import { createRemoteFeedback } from "@/lib/feedback/remote";

const feedback: Feedback = { messageId: "m1", rating: "up", comment: "nice" };

describe("feedback sink (US3)", () => {
  it("remote sink POSTs the feedback to the configured URL", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 200 }),
    );
    const sink = createRemoteFeedback(
      "https://f.example/feedback",
      fetchMock as unknown as typeof fetch,
    );
    await sink.submit(feedback);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://f.example/feedback");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(feedback);
  });

  it("remote sink rejects on a non-2xx response (caller keeps selection)", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 500 }),
    );
    const sink = createRemoteFeedback(
      "https://f.example/feedback",
      fetchMock as unknown as typeof fetch,
    );
    await expect(sink.submit(feedback)).rejects.toBeInstanceOf(Error);
  });

  it("resolves to a no-op mock sink when no feedback URL is set", async () => {
    const sink = resolveFeedback({});
    await expect(sink.submit(feedback)).resolves.toBeUndefined();
  });

  it("resolves to a remote sink when a feedback URL is set", async () => {
    const makeRemote = vi.fn(() => ({ submit: vi.fn(async () => {}) }));
    const sink = resolveFeedback(
      { feedbackUrl: "https://f.example" },
      { makeRemote },
    );
    await sink.submit(feedback);
    expect(makeRemote).toHaveBeenCalledWith("https://f.example");
  });
});
