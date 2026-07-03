import {
  findMockConversation,
  MOCK_CONVERSATIONS,
} from "../mock-conversations.dev";

// Dev-only history DETAIL mock. Mirrors the HistoryProvider remote read contract:
//   GET /api/history/{id} → 200 { conversation: Conversation | null }
// Under `output: export` a dynamic-segment GET must be statically renderable, so we
// enumerate the seeded ids via generateStaticParams and force static output. Gated out
// of `next build` by the `.dev.ts` extension, so none of this reaches the export.
export const dynamic = "force-static";

export function generateStaticParams(): Array<{ conversationId: string }> {
  return MOCK_CONVERSATIONS.map((c) => ({ conversationId: c.id }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
): Promise<Response> {
  const { conversationId } = await params;
  const conversation = findMockConversation(conversationId);
  return new Response(JSON.stringify({ conversation }), {
    status: conversation ? 200 : 404,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
