"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "getting-started", label: "Getting Started" },
  { id: "architecture", label: "Architecture & Boundaries" },
  { id: "configuration", label: "Configuration (Env)" },
  { id: "transport", label: "Chat Transport & Streaming" },
  { id: "dev-tools", label: "Dev Tools" },
  { id: "builtin-tools", label: "Tool Rendering & Skills" },
  { id: "backend-integration", label: "Backend Integration Guide" },
  { id: "customization", label: "Customization & Theming" },
];

export function TableOfContents() {
  // Default to the first section so the marker is visible before any scroll.
  const [activeId, setActiveId] = React.useState<string>(SECTIONS[0].id);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-10% 0px -70% 0px" }
    );

    SECTIONS.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="relative flex w-full flex-col gap-0.5 border-l border-border/60 pl-4">
      <span className="mb-3 px-3 text-xs font-medium text-muted-foreground">
        On this page
      </span>

      {SECTIONS.map(({ id, label }) => {
        const isActive = activeId === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors duration-300",
              isActive
                ? "text-foreground"
                : "text-muted-foreground/70 hover:text-foreground"
            )}
          >
            {isActive && (
              <>
                <motion.div
                  layoutId="active-toc-pill"
                  className="absolute inset-0 z-[-1] rounded-lg bg-muted"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                    mass: 0.8,
                  }}
                />
                <motion.div
                  layoutId="active-toc-marker"
                  className="absolute -left-4.25 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              </>
            )}
            {label}
          </a>
        );
      })}
    </nav>
  );
}
