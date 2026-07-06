import { summarizeConversation } from "@/lib/api/history";

import { ALL_MOCK_CONVERSATIONS } from "./mock-conversations.dev";

// Dev-only history LIST mock for `NEXT_PUBLIC_HISTORY_API_URL=/api/history` (the
// docker/dev default). Gated out of `next build` via the `.dev.ts` extension, so it
// never ships in the static export. Mirrors the paginated read contract:
//   GET /api/history?page&per_page → 200 { items, page, per_page, total }  (newest-first)
// The per-conversation turns (with inline feedback) come from GET /api/history/{id}.
//
// This route is gated out of the `output: export` build entirely, so it only ever runs
// under `next dev` (the docker/dev server). It MUST be dynamic: `force-static` makes Next
// statically cache the response and drop `searchParams`, so `page` always read as 1 and
// every `?page=N` returned page 1 — an endless "load more" that never advanced. Reading
// query params per request is what makes the sidebar's pagination actually paginate.
//
// `force-dynamic` is only legal because `next.config.ts` omits `output: "export"` under
// `next dev` (it is rejected outright while `output: "export"` is set, even in dev — the
// route 500s with "cannot be used with output: export"). See the note in `next.config.ts`.
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.max(1, Number(searchParams.get("per_page")) || 20);

  const all = ALL_MOCK_CONVERSATIONS.map(summarizeConversation).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  const start = (page - 1) * perPage;
  const items = all.slice(start, start + perPage);

  return new Response(
    JSON.stringify({ items, page, per_page: perPage, total: all.length }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-transform",
      },
    },
  );
}
