import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CapabilityConfig } from "@/entities";
import type { ChatStreamHandlers, ChatTransport } from "@/lib/chat/transport";
import { useChat } from "@/hooks/chat/use-chat";
import { extractUserRequest, parseFrames } from "@/lib/chat/recording";
import { resetSessionStore } from "@/store/session-store";

const config: CapabilityConfig = {
  chatEndpointUrl: "https://agent.example/invocations",
};

/** A transport that lets a test push raw frames + a terminal into the active turn. */
function capturingTransport() {
  let handlers: ChatStreamHandlers | null = null;
  const transport: ChatTransport = {
    send: (_input, h) => {
      handlers = h;
      return new AbortController();
    },
  };
  return {
    transport,
    frame: (data: string) => act(() => handlers?.onRawFrame?.(data)),
    emit: (delta: string) =>
      act(() =>
        handlers?.onEvent({ type: "token", delta }),
      ),
    close: () => act(() => handlers?.onClose?.("done")),
  };
}

beforeEach(() => {
  resetSessionStore();
});

describe("useChat — live-turn recording capture (US5 / FR-031)", () => {
  it("captures raw frames and downloads a replayable .txt embedding the question", async () => {
    const t = capturingTransport();
    const { result } = renderHook(() => useChat({ config, transport: t.transport }));

    act(() => result.current.send("What is 2 + 2?"));

    const frame1 = JSON.stringify({
      type: "response.output_text.delta",
      delta: "4",
    });
    t.frame(frame1);
    t.emit("4");
    t.close();

    await waitFor(() => expect(result.current.status).toBe("idle"));

    // The completed assistant turn is now downloadable.
    const assistant = result.current.messages.find((m) => m.role === "assistant");
    expect(assistant).toBeDefined();
    expect(result.current.recordedIds.has(assistant!.id)).toBe(true);

    // Downloading serializes a recording whose sentinel carries the original question and
    // whose frames round-trip the captured stream.
    const created: string[] = [];
    const clicks = vi.fn();
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      // Read the blob text synchronously via a captured reference for assertion below.
      (blob as Blob & { _test?: string })._test = "";
      created.push("url");
      return "blob:mock";
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(clicks);

    // Capture the Blob content by wrapping Blob.
    let blobText = "";
    const RealBlob = globalThis.Blob;
    globalThis.Blob = class extends RealBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        blobText = String(parts[0]);
      }
    } as unknown as typeof Blob;

    act(() => result.current.downloadRecording(assistant!.id));

    expect(clicks).toHaveBeenCalledOnce();
    expect(extractUserRequest(blobText)).toBe("What is 2 + 2?");
    expect(parseFrames(blobText)).toContain(frame1);

    // Restore globals.
    globalThis.Blob = RealBlob;
    URL.createObjectURL = realCreate;
    clickSpy.mockRestore();
  });

  it("does not mark a turn recordable when no frames were captured", async () => {
    const t = capturingTransport();
    const { result } = renderHook(() => useChat({ config, transport: t.transport }));

    act(() => result.current.send("hello"));
    // No frames tapped (e.g. an immediate error/abort) — just close.
    t.close();
    await waitFor(() => expect(result.current.status).toBe("idle"));

    expect(result.current.recordedIds.size).toBe(0);
  });
});
