import { summarizeConversation } from "@/lib/history/summary";

import { MOCK_CONVERSATIONS } from "./mock-conversations.dev";

// Dev-only history LIST mock for `NEXT_PUBLIC_HISTORY_API_URL=/api/history` (the
// docker/dev default). Gated out of `next build` via the `.dev.ts` extension, so it
// never ships in the static export. Mirrors the HistoryProvider remote read contract:
//   GET /api/history → 200 { conversations: ConversationSummary[] }  (newest-first)
// The per-conversation turns (with inline feedback) come from GET /api/history/{id}.
export const dynamic = "force-static";

export function GET(): Response {
  const conversations = MOCK_CONVERSATIONS.map(summarizeConversation).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  return new Response(JSON.stringify({ conversations }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
