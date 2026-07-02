# ADR: Dev-only same-origin mock chat endpoint

**Status**: Accepted (2026-07-01)

## Context

The UI streams from a single endpoint (`NEXT_PUBLIC_CHAT_ENDPOINT_URL`) speaking the
Databricks Playground / MLflow ResponsesAgent SSE format (see
[`chat-transport.md`](../../.specify/specs/001-chat-mvp/contracts/chat-transport.md)).
For a zero-Databricks demo we want the browser to reach a mock **same-origin** — no
second hostname, no CORS — especially in the docker/`next dev` container served behind
the Cloudflare tunnel (`dbx-ui.timezlab.org`).

The obvious approach — an App Router route handler at `app/api/chat/route.ts` that
streams a recording — conflicts head-on with the repo's core constraint: the app builds
with `output: "export"` (static export for Databricks), which is **UI-only, no backend**
(constitution I/III). Concretely:

- A streaming `POST` route handler with `export const dynamic = "force-dynamic"` makes
  `next build` fail: *"`dynamic = "force-dynamic"` … cannot be used with `output: export`"*.
- The same error is thrown at **request time in `next dev`** (500), because the dev
  server loads the route module against the exported config.

So a route handler cannot ship in the static artifact, and naively adding one breaks both
the build and the dev server.

## Decision

Keep a mock route, but make it **dev-only and invisible to the static build**:

1. The handler lives at `src/app/api/chat/route.dev.ts` (note the `.dev.ts` extension).
2. `next.config.ts` sets `pageExtensions` to include `dev.ts`/`dev.tsx` **only when
   `NODE_ENV === "development"`** (i.e. `next dev`). `next build` (production) uses the
   base extensions, so `route.dev.ts` is never collected as a route → static export stays
   clean (verified: no `out/api`, build exits 0).
3. The handler does **not** declare `export const dynamic = "force-dynamic"` — a `POST`
   handler is already dynamic in `next dev`, and that directive is rejected while
   `output: "export"` is set.
4. It streams a recording (real capture `public/recordings/rbg-performance-2026.txt` if
   present, else the committed `default.txt`; override via `MOCK_RECORDING`), pacing text
   fast and tool events slower. `docker-compose.yml` defaults
   `NEXT_PUBLIC_CHAT_ENDPOINT_URL=/api/chat` (trailing slash matches `trailingSlash:
   true`, avoiding a 308 on POST).

The standalone `scripts/mock-api.mjs` (a separate HTTP server) still exists for setups
that point the endpoint at an **external** URL instead of this same-origin route.

## Alternatives considered

- **Ship a normal route handler** — rejected: breaks `next build` (static export) and the
  dev server while `output: "export"` is set.
- **`next.config` rewrites → mock-api sidecar container** — viable (rewrites are ignored,
  not fatal, under export) and keeps same-origin, but requires running a second service
  and does not match "a Next API route". Kept in reserve if the sidecar is preferred.
- **Point the endpoint at the mock-api script via a second tunnel hostname** — rejected:
  reintroduces CORS + a separate public hostname, the friction we wanted to avoid.

## Consequences

**Better**: zero-Databricks demo works same-origin in the docker/dev container; no CORS,
no extra hostname; the real capture drives a realistic stream.

**Worse**: one dev-only route file that is *not* exercised by the static build — a reader
must understand the `.dev.ts` + `pageExtensions` gate (documented here and in-file).

**Must now be true**:
- `next.config.ts` keeps the `NODE_ENV`-gated `pageExtensions`; removing it would either
  expose the route to `next build` (breaking the static export) or hide it from `next dev`
  (breaking the demo).
- The dev mock route must never declare `dynamic = "force-dynamic"` (or any directive that
  `output: "export"` rejects).
- The shipped **static export** contains no `api/` output — the UI-only/no-backend
  guarantee (constitution I/III) holds for the Databricks artifact.
