import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/app/globals.css";
// Self-host Inter for the embed (next/font doesn't run here). Sets `--font-sans`.
import "./inter.css";

// Embed entry point for Docs page.
// Shares components from src/ but avoids Next.js runtime assumptions.
const [
  { default: DocsPage },
  { ThemeProvider }
] = await Promise.all([
  import("../src/app/docs/page"),
  import("../src/components/theme/theme-provider")
]);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <DocsPage />
    </ThemeProvider>
  </StrictMode>
);
