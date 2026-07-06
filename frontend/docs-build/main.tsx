import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/app/globals.css";
// Self-host Inter for the embed (next/font doesn't run here). Sets `--font-sans`.
import "./inter.css";

// Embed entry point for Docs page.
// Shares components from src/ but avoids Next.js runtime assumptions.
const [
  { default: DocsPage },
  { ThemeProvider },
  { Providers }
] = await Promise.all([
  import("../src/app/docs/page"),
  import("../src/components/theme/theme-provider"),
  import("../src/app/providers")
]);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// Mirror `app/layout.tsx`: ThemeProvider → Providers → page. The docs page embeds a
// live chat demo whose `ChatProvider` calls `useHistoryMutations()` → `useQueryClient()`,
// which throws "No QueryClient set" without this provider (history stays disabled here
// since the demo config has no historyUrl — the client just needs to exist).
createRoot(root).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Providers>
        <DocsPage />
      </Providers>
    </ThemeProvider>
  </StrictMode>
);
