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
  output: "export",
  pageExtensions,
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
  trailingSlash: true,
  // Allow the dev server to accept cross-origin requests proxied through the
  // Cloudflare tunnel (dbx-ui.timezlab.org -> dbx-ui:3000). Dev-only; ignored by
  // the static export build. Not a secret — just a non-secret host allowlist.
  allowedDevOrigins: ["dbx-ui.timezlab.org"],
};

export default nextConfig;
