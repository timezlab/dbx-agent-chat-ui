import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CapabilityConfig } from "@/entities";
import type { ChatStreamHandlers, ChatTransport } from "@/lib/chat/transport";
import { useChat } from "@/hooks/chat/use-chat";
import { extractUserRequest, parseFrames } from "@/lib/chat/recording";
import { createResponsesParser } from "@/lib/chat/responses";
import { resetSessionStore } from "@/store/session-store";

const config: CapabilityConfig = {
  chatEndpointUrl: "https://agent.example/invocations",
};

/** A transport that lets a test push events + a terminal into the active turn. */
function drivingTransport() {
  let handlers: ChatStreamHandlers | null = null;
  const transport: ChatTransport = {
    send: (_input, h) => {
      handlers = h;
      return new AbortController();
    },
  };
  return {
    transport,
    emit: (delta: string) =>
      act(() => handlers?.onEvent({ type: "token", delta })),
    close: () => act(() => handlers?.onClose?.("done")),
  };
}

/** Capture the text written to the download Blob, spying the DOM/anchor plumbing. */
function withBlobCapture(run: () => void): { blobText: string; clicks: number } {
  const clicks = vi.fn();
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = vi.fn(() => "blob:mock") as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(clicks);
  let blobText = "";
  const RealBlob = globalThis.Blob;
  globalThis.Blob = class extends RealBlob {
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      blobText = String(parts[0]);
    }
  } as unknown as typeof Blob;

  try {
    run();
  } finally {
    globalThis.Blob = RealBlob;
    URL.createObjectURL = realCreate;
    clickSpy.mockRestore();
  }
  return { blobText, clicks: clicks.mock.calls.length };
}

beforeEach(() => {
  resetSessionStore();
});

describe("useChat — recording download by reconstruction (US5 / FR-031)", () => {
  it("downloads a .txt synthesized from the reconciled turn, embedding the question", async () => {
    const t = drivingTransport();
    const { result } = renderHook(() => useChat({ config, transport: t.transport }));

    act(() => result.current.send("What is 2 + 2?"));
    t.emit("The answer ");
    t.emit("is four.");
    t.close();

    await waitFor(() => expect(result.current.status).toBe("idle"));

    const assistant = result.current.messages.find((m) => m.role === "assistant");
    expect(assistant).toBeDefined();

    const { blobText, clicks } = withBlobCapture(() =>
      act(() => result.current.downloadRecording(assistant!.id)),
    );

    expect(clicks).toBe(1);
    expect(extractUserRequest(blobText)).toBe("What is 2 + 2?");

    // The reconstructed recording re-parses to the SAME visible text the turn showed.
    const parser = createResponsesParser();
    const text = parseFrames(blobText)
      .flatMap((f) => {
        try {
          return parser.map(JSON.parse(f));
        } catch {
          return [];
        }
      })
      .filter((e) => e.type === "token")
      .map((e) => (e as { delta: string }).delta)
      .join("");
    expect(text).toBe("The answer is four.");
  });

  it("is a no-op for a still-streaming turn (no content settled yet)", async () => {
    const t = drivingTransport();
    const { result } = renderHook(() => useChat({ config, transport: t.transport }));

    act(() => result.current.send("hello"));
    // Do NOT close — the assistant turn is still streaming.
    const streaming = result.current.messages.find((m) => m.role === "assistant");
    expect(streaming?.status).toBe("streaming");

    const { clicks } = withBlobCapture(() =>
      act(() => result.current.downloadRecording(streaming!.id)),
    );
    expect(clicks).toBe(0);
  });

  it("is a no-op for an empty settled turn (nothing visible to replay)", async () => {
    const t = drivingTransport();
    const { result } = renderHook(() => useChat({ config, transport: t.transport }));

    act(() => result.current.send("hello"));
    // Close immediately with no content (e.g. an instant error/abort).
    t.close();
    await waitFor(() => expect(result.current.status).toBe("idle"));

    const assistant = result.current.messages.find((m) => m.role === "assistant");
    const { clicks } = withBlobCapture(() =>
      act(() => result.current.downloadRecording(assistant!.id)),
    );
    expect(clicks).toBe(0);
  });
});
