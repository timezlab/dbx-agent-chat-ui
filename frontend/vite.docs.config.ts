import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";
import fs from "node:fs";

// Docs build — produces a self-contained static artifact in the repo root as index.html
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "NEXT_PUBLIC_");
  
  const processEnvDefines: Record<string, string> = {};
  for (const key in env) {
    if (key.startsWith("NEXT_PUBLIC_")) {
      processEnvDefines[`process.env.${key}`] = JSON.stringify(env[key]);
    }
  }

  const logoPath = resolve(__dirname, "public/logo.svg");
  const logoBase64 = fs.readFileSync(logoPath, "base64");
  const injectFaviconPlugin = () => ({
    name: "inject-favicon",
    transformIndexHtml(html: string) {
      return html.replace(
        "</head>",
        `  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${logoBase64}" />\n  </head>`
      );
    },
  });

  return {
    plugins: [react(), viteSingleFile(), injectFaviconPlugin()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    root: "docs-build",
    base: "./",
    define: processEnvDefines,
    css: {
      postcss: __dirname,
    },
    build: {
      outDir: resolve(__dirname, ".."),
      emptyOutDir: false,
      sourcemap: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      rollupOptions: {
        input: resolve(__dirname, "docs-build/index.html"),
      },
    },
  };
});
