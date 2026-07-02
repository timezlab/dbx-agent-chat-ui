// Dev-only same-origin mock chat endpoint. Streams a recorded Databricks Playground
// (MLflow ResponsesAgent) SSE response so the UI runs with ZERO Databricks access and
// no CORS (same origin as the app). The browser posts here when
// `NEXT_PUBLIC_CHAT_ENDPOINT_URL=/api/chat` (the docker/dev demo default).
//
// IMPORTANT — this route is a DEV-ONLY convenience. The `.dev.ts` extension is only in
// `pageExtensions` during `next dev` (see next.config.ts), so `next build` (the
// Databricks `output: "export"` static build) never sees it as a route — the shipped
// static artifact stays pure UI-only with no backend (Principle I/III). A streaming
// route handler cannot coexist with `output: "export"` (build error), hence the gate.
// See docs/design-docs/dev-mock-endpoint.md.
//
// The standalone `scripts/mock-api.mjs` serves the SAME recording for setups that point
// the endpoint at an external URL instead of this same-origin route.

import { access, readFile } from "node:fs/promises";
import path from "node:path";

// Frame parsing + per-frame delay come from the shared pure module, so the mock and the
// client-side replay stream frames identically (FR-017 / FR-018 — single source of truth).
import { delayFor, parseFrames } from "@/lib/stream/recording";

// NB: no `export const dynamic = "force-dynamic"` — that directive is rejected while
// `output: "export"` is set (even in `next dev`). A POST handler is dynamic by nature
// in dev, so the stream still works; the `.dev.ts` gate keeps it out of the static build.

// Recording to replay, first match wins (paths relative to the app cwd):
//   1. MOCK_RECORDING env override
//   2. the real captured stream (gitignored local dev capture, if present)
//   3. the committed small sample (always available, e.g. fresh clone / CI)
const RECORDING_CANDIDATES = [
  process.env.MOCK_RECORDING,
  "sse-recordings/rbg-performance-2026.txt", // real capture (gitignored, local)
  "sse-recordings/default.txt", // committed small sample (always present)
].filter(Boolean) as string[];

async function resolveRecordingPath(): Promise<string | null> {
  for (const rel of RECORDING_CANDIDATES) {
    const abs = path.join(process.cwd(), rel);
    try {
      await access(abs);
      return abs;
    } catch {
      // not present → try the next candidate
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request): Promise<Response> {
  const recordingPath = await resolveRecordingPath();
  if (!recordingPath) {
    return new Response(
      JSON.stringify({ error: "Mock recording: no recording file found" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  let recording: string;
  try {
    recording = await readFile(recordingPath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : "unreadable recording";
    return new Response(JSON.stringify({ error: `Mock recording: ${message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const frames = parseFrames(recording);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const payload of frames) {
        if (request.signal.aborted) break;
        await sleep(delayFor(payload));
        if (request.signal.aborted) break;
        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          break; // client disconnected
        }
      }
      try {
        controller.close();
      } catch {
        /* already closed on abort */
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
