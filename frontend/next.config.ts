import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
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
