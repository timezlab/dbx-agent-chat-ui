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
  const [activeId, setActiveId] = React.useState<string>("");

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

    // Set initial active state if at top
    if (window.scrollY < 100) {
      setActiveId(SECTIONS[0].id);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className="w-full"
    >
      <div className="pointer-events-auto">
        <nav className="flex flex-col gap-1 border-l border-border/10 pl-4 relative">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/40 mb-3 px-3"
          >
            Contents
          </motion.span>

          {/* Animated vertical track line to give it structuralism feel */}
          <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-border/20 to-transparent" />

          {SECTIONS.map(({ id, label }) => {
            const isActive = activeId === id;
            return (
              <motion.a
                key={id}
                href={`#${id}`}
                whileHover={{ scale: 0.98, x: 4 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "relative text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors duration-500",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground/60 hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-toc-pill"
                    className="absolute inset-0 bg-black/5 dark:bg-white/10 rounded-xl border border-black/5 dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] z-[-1]"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                      mass: 0.8
                    }}
                  />
                )}

                {/* Active side indicator */}
                <motion.div
                  initial={false}
                  animate={{
                    height: isActive ? 20 : 0,
                    opacity: isActive ? 1 : 0
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className={cn(
                    "absolute -left-[17px] top-1/2 -translate-y-1/2 w-[2px] bg-foreground rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)] dark:shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                  )}
                />

                {label}
              </motion.a>
            );
          })}
        </nav>
      </div>
    </motion.div>
  );
}
