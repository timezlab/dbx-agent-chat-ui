"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Thin client wrapper over `next-themes`. Mounted once at the app root so `.dark`
 * is toggled on `<html>` and every `dark:`/CSS-variable token flips together
 * (Page Theme Lock). Client-only — the anti-FOUC inline script `next-themes`
 * injects is compatible with `output: "export"` (no request-time work).
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export default ThemeProvider;
