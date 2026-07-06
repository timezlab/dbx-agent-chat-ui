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
  { ThemeProvider },
  { Providers }
] = await Promise.all([
  import("../src/components/shell/app-shell"),
  import("../src/components/theme/theme-provider"),
  import("../src/app/providers")
]);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// Mirror the Next.js `app/layout.tsx` nesting exactly: ThemeProvider → Providers →
// app. `Providers` supplies the TanStack `QueryClient` the history hooks need (without
// it the sidebar's `useInfiniteQuery` throws "No QueryClient set") and rehydrates the
// persisted session store, so this pure-client embed behaves like the Next build.
createRoot(root).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Providers>
        <AppShell />
      </Providers>
    </ThemeProvider>
  </StrictMode>
);
