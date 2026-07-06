import type { NextConfig } from "next";

// Dev-only files use a `.dev.ts(x)` extension and are ONLY treated as routes/pages
// during `next dev`. `next build` (the Databricks `output: "export"` static build)
// omits `.dev.*` from pageExtensions, so the dev mock endpoint `app/api/chat/route.dev.ts`
// is invisible to the export — a streaming route handler cannot coexist with
// `output: "export"`, so this gate keeps the static build clean while the docker/dev
// server still serves the same-origin mock. See docs/design-docs/dev-mock-endpoint.md.
const BASE_PAGE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];
const isDev = process.env.NODE_ENV === "development";
const pageExtensions = isDev
  ? [...BASE_PAGE_EXTENSIONS.map((e) => `dev.${e}`), ...BASE_PAGE_EXTENSIONS]
  : BASE_PAGE_EXTENSIONS;

const nextConfig: NextConfig = {
  // `output: "export"` is the PRODUCTION shape — the shipped static artifact. In dev it is
  // OMITTED so the dev-only mock routes (`app/api/**/route.dev.ts`) can be real dynamic
  // handlers that read query params: `output: "export"` forbids a `dynamic` route handler,
  // so with it set even in `next dev` a `force-dynamic` mock 500s ("cannot be used with
  // output: export") and a `force-static` one silently drops `searchParams` (so `?page`
  // always read as 1 — the endless "load more" that never advances). The `.dev.*` routes are
  // gated out of `next build` via `pageExtensions` anyway, so the production export stays a
  // pure static build with no route handlers — the static-export guarantee holds for what
  // actually ships.
  output: isDev ? undefined : "export",
  pageExtensions,
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
  // No `trailingSlash: true`: it 308-redirected every non-slash URL to its slash form
  // (`/api/history?…` → `/api/history/?…`, `/docs` → `/docs/`) — a wasted redirect hop on
  // every history request. Pages export as `docs.html` (served at `/docs`) instead of
  // `docs/index.html`; the size-only manual-output check is unaffected.
  // Allow the dev server to accept cross-origin requests proxied through the
  // Cloudflare tunnel (dbx-ui.timezlab.org -> dbx-ui:3000). Dev-only; ignored by
  // the static export build. Not a secret — just a non-secret host allowlist.
  allowedDevOrigins: ["dbx-ui.timezlab.org"],
};

export default nextConfig;
