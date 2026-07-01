"use client";

import * as React from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ThemeToggleProps = React.ComponentProps<typeof Button>;

/**
 * Light/dark quick-toggle. Both icons render in SSR HTML and are shown/hidden by
 * the `.dark` class (no mounted effect → no hydration flash, no setState cascade).
 * Toggles `resolvedTheme` so a "system" user lands on the opposite of what they see.
 */
export function ThemeToggle({ className, ...props }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-slot="theme-toggle"
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(className)}
      {...props}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="block dark:hidden" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export default ThemeToggle;
