"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Section wrapper: consistent scroll anchor, reveal animation, and header. */
export function DocsSection({
  id,
  icon,
  title,
  children,
  className,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      id={id}
      className={cn("scroll-mt-28 space-y-6", className)}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <header className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      </header>
      {children}
    </motion.section>
  );
}

/** Lead paragraph under a section header. */
export function SectionLead({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[70ch] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

/** Inline code chip, consistent across all sections. */
export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

/** Icon + title + description card used in feature grids. */
export function DocCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-border">
      <div className="flex size-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h4 className="font-medium tracking-tight text-foreground">{title}</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {desc}
        </p>
      </div>
    </div>
  );
}

/** Numbered step with a connecting rail, for setup instructions. */
export function Step({
  index,
  title,
  isLast = false,
  children,
}: {
  index: number;
  title: string;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pl-12">
      {!isLast && (
        <div
          aria-hidden
          className="absolute -bottom-8 left-[15.5px] top-8 w-px bg-border/60"
        />
      )}
      <div className="absolute left-0 top-0 flex size-8 items-center justify-center rounded-full border border-border/60 bg-card font-mono text-xs font-medium text-muted-foreground">
        {index}
      </div>
      <h3 className="pt-1 text-lg font-medium tracking-tight">{title}</h3>
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  );
}

/** Accent callout for notes that deserve emphasis. */
export function Callout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-r-2xl border-l-2 border-primary bg-primary/5 py-4 pl-5 pr-5">
      <h4 className="mb-1.5 text-sm font-medium text-foreground">{title}</h4>
      <div className="text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
