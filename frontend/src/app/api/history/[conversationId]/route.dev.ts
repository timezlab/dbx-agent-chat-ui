import {
  ALL_MOCK_CONVERSATIONS,
  findMockConversation,
} from "../mock-conversations.dev";

// Dev-only history DETAIL mock. Mirrors the read contract:
//   GET /api/history/{id} → 200 Conversation   (the object directly, no envelope)
//                         → 404                 (unknown id)
// Under `output: export` a dynamic-segment GET must be statically renderable, so we
// enumerate the seeded ids via generateStaticParams and force static output. Gated out
// of `next build` by the `.dev.ts` extension, so none of this reaches the export.
export const dynamic = "force-static";

export function generateStaticParams(): Array<{ conversationId: string }> {
  return ALL_MOCK_CONVERSATIONS.map((c) => ({ conversationId: c.id }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
): Promise<Response> {
  const { conversationId } = await params;
  const conversation = findMockConversation(conversationId);
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-transform",
  };
  if (!conversation) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers,
    });
  }
  return new Response(JSON.stringify(conversation), { status: 200, headers });
}
