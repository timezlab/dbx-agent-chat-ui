// Dev-only same-origin mock identity endpoint. Returns a fixed Databricks-style user
// identity as JSON so the sidebar identity chip renders with ZERO Databricks access and
// no CORS (same origin as the app). The browser GETs here when
// `NEXT_PUBLIC_ME_API_URL=/api/me` (the docker/dev demo default).
//
// IMPORTANT — like the mock chat route, the `.dev.ts` extension is only in
// `pageExtensions` during `next dev` (see next.config.ts), so `next build` (the
// Databricks `output: "export"` static build) never sees it as a route — the shipped
// static artifact stays pure UI-only with no backend (Principle I/III). A real host
// supplies its own `me` endpoint and points `NEXT_PUBLIC_ME_API_URL` at it.

import type { Identity } from "@/entities";

// `output: export` requires a GET route handler to be statically renderable — unlike the
// POST chat mock (POST is never prerendered), a bare GET must opt in explicitly or dev
// throws "dynamic/revalidate not configured". The response is a constant, so force-static
// is correct: it prerenders once. (`.dev.ts` still keeps this route out of `next build`.)
export const dynamic = "force-static";

// A representative identity: `email` (required) plus every optional field populated so a
// local demo exercises the full chip + dropdown. Mirror of a DB_SAML_SSO session.
const MOCK_IDENTITY: Identity = {
  email: "dai.le@timezlab.org",
  username: "dai.le",
  user_id: "u-8f3a1c92",
  session_id: "sess-4b7e-demo",
  auth_type: "DB_SAML_SSO",
  org_id: "org-1024",
};

export function GET(): Response {
  return new Response(JSON.stringify(MOCK_IDENTITY), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
