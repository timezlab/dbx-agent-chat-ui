import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/app/globals.css";
// Self-host Inter for the embed (next/font doesn't run here). Sets `--font-sans`.
import "./inter.css";

// Embed entry point — constrained fallback for manual-copy proxy mode.
// Shares chat UI components from src/ but avoids Next.js runtime assumptions.
// Components are imported lazily to keep the initial bundle small.
const [
  { AppShell },
  { ThemeProvider }
] = await Promise.all([
  import("../src/components/shell/app-shell"),
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
      <AppShell />
    </ThemeProvider>
  </StrictMode>
);
