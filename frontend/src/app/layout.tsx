import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme/theme-provider";

// Inter is the single UI face; it feeds `--font-sans` (globals.css @theme inline).
// Code/paths use the platform monospace stack (no second webfont — see globals.css).
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DBX Agent UI",
  description: "A reusable, UI-only chat frontend for Databricks agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // next-themes writes the theme class here before paint; suppress the
      // expected server/client class mismatch it introduces.
      suppressHydrationWarning
      className={cn("h-full antialiased", inter.variable, "font-sans")}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
