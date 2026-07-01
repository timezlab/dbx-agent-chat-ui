import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Embed build — produces a self-contained static artifact in manual/.
// Used for constrained notebook/proxy hosts that can only serve a small number of files.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  root: "embed",
  build: {
    outDir: resolve(__dirname, "manual"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(__dirname, "embed/index.html"),
    },
  },
});
