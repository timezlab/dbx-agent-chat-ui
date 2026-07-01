# Repository Boundaries: Static Export, UI-Only, Auth Outside

**Status:** accepted
**Date:** 2026-07-01
**Covers:** D-002 (static export contract), D-003 (UI-only repo), D-013 (auth boundary)

## Context

This repository is a reusable chat UI, not a backend runtime. It must deploy to
constrained targets (notebook/proxy hosting that serves only static files) as well
as richer wrappers (Databricks Apps). To keep that flexibility — and to keep
Databricks secrets out of the browser — the repo draws a hard boundary: it owns
the frontend UI and nothing that touches credentials or server runtime.

## Decision

### Static export is the shared frontend contract (D-002)

Build with `next build` and `output: "export"`. Baseline `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
  trailingSlash: true,
};

export default nextConfig;
```

### Keep this repository UI-only (D-003)

This repo owns the frontend UI only. It builds to static assets and must not
include a Node.js backend, BFF, API route implementation, or Databricks credential
handling. The UI may call a configured public/browser-safe endpoint through
client-side adapters, but that endpoint is provided by an external notebook proxy,
Databricks app, gateway, or backend owned outside this repo.

### Authentication is outside the frontend UI scope (D-013)

The UI may send browser-safe requests to a configured endpoint, but it must not own
Databricks auth exchange, service-principal credentials, user-token forwarding,
endpoint grants, or secret loading. Assume auth is handled by the
proxy/notebook/backend/wrapper layer.

## Alternatives considered

- **Bundle a Node.js BFF / API proxy in this repo** — rejected. It would break the
  static-export target for notebook/proxy hosting and pull credential handling into
  a repo meant to be a reusable, secret-free UI.
- **Own Databricks auth in the frontend** — rejected. Secrets in a static bundle are
  a leak by construction; auth belongs to the deployment wrapper.

## Consequences

**Better:**
- One static `out/` artifact serves every deployment target.
- No secret can leak from this repo because none live here.

**Worse:**
- Every deployment needs an external layer to provide the endpoint and auth.
- Cannot use Next server features (route handlers, server actions, cookies, request-time headers).

**Must now be true (invariants):**
- Browser bundles must **never** contain Databricks secrets, OAuth client secrets, PATs, or service-principal credentials.
- Do **not** depend on Next route handlers, server actions, cookies, rewrites, redirects, or request-time headers in the shared UI.
- Keep all chat data fetching in client-side adapters (see [`chat-transport.md`](./chat-transport.md)).
- Use `NEXT_PUBLIC_*` values only for public endpoint selection and non-secret UI config.
- No Express/other Node.js server packages; no auth exchange, user-token forwarding, or same-origin API proxy code in this repo.
- Out of scope: server-side persistence, MLflow logging, Lakebase storage, or serving-endpoint calls from this repo.

## Revisit if

The organization commits to a single wrapper (e.g. Databricks Apps) as the only
deployment target and explicitly wants a co-located BFF — that would be a new repo
or a superseding decision, not a change here.
