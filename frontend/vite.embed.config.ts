import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";
import fs from "node:fs";

// Embed build — produces a self-contained static artifact in manual/.
// Used for constrained notebook/proxy hosts that can only serve a small number of files.
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, resolve(__dirname, ".."), "NEXT_PUBLIC_");
  
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
    root: "embed",
    base: "./",
    define: processEnvDefines,
    css: {
      postcss: __dirname,
    },
    build: {
      outDir: resolve(__dirname, "out-embed"),
      emptyOutDir: true,
      sourcemap: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      rollupOptions: {
        input: resolve(__dirname, "embed/index.html"),
      },
    },
  };
});
