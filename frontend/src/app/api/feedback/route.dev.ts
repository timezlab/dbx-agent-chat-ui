// Dev-only feedback mock for `NEXT_PUBLIC_FEEDBACK_API_URL=/api/feedback` (the
// docker/dev default). Gated out of `next build` via the `.dev.ts` extension, so it
// never ships in the static export. Mirrors the FeedbackSink remote contract:
//   POST /api/feedback ← { messageId, rating: "up"|"down", comment? } → 200 { ok: true }
// A POST handler is never prerendered, so (unlike a GET) it needs no `force-static`.
// The mock accepts and discards — feedback also rides along on the message itself and
// round-trips through history; this endpoint is just the write sink.
export async function POST(request: Request): Promise<Response> {
  try {
    await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
