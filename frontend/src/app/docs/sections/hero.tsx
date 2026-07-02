"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRightIcon } from "lucide-react";
import { GithubIcon } from "@/components/icons/github";
import { DatabricksIcon } from "@/components/icons/databricks";
import { EASE } from "../components";

const TECH_STACK = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "Tailwind v4",
  "Static Export",
  "shadcn/ui",
  "TanStack Query",
  "SSE Streaming",
];

export function DocsHero() {
  const reduce = useReducedMotion();

  const fadeUp = reduce
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.4 } },
      }
    : {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
      };

  return (
    <div className="relative z-10 border-b border-border/60">
      <motion.header
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.08, delayChildren: 0.05 },
          },
        }}
        className="mx-auto flex max-w-350 flex-col items-center px-6 pb-16 pt-20 text-center md:px-12 md:pt-24"
      >
        {/* Databricks brand mark keeps its official color in both themes */}
        <motion.div
          variants={fadeUp}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
        >
          <DatabricksIcon className="size-3.5 text-[#FF3621]" />
          <span>Databricks Agent Interface</span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="max-w-4xl text-4xl font-medium leading-[1.05] tracking-tighter md:text-6xl"
        >
          Drop-in chat UI <br className="hidden md:block" />
          <span className="text-muted-foreground">for Databricks agents.</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mt-6 max-w-[58ch] text-lg leading-relaxed text-muted-foreground"
        >
          One static build serves notebook proxies, Databricks Apps, and
          manual-copy deployment. No backend, no secrets in the bundle.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <a
            href="https://github.com/timezlab/dbx-agent-chat-ui"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-4 rounded-full bg-foreground py-2 pl-6 pr-2 font-medium text-background transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              <GithubIcon className="size-4" />
              <span>View on GitHub</span>
            </span>
            <span className="flex size-8 items-center justify-center rounded-full bg-background/20 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-rotate-45 group-hover:bg-background/30">
              <ArrowRightIcon className="size-3.5" strokeWidth={1.5} />
            </span>
          </a>
          <a
            href="#introduction"
            className="inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-3.25 text-sm text-muted-foreground transition-colors duration-300 hover:border-border hover:text-foreground"
          >
            Read the docs
            <ArrowRightIcon className="size-3.5 rotate-90" strokeWidth={1.5} />
          </a>
        </motion.div>
      </motion.header>

      {/* Tech stack strip, deliberately outside the hero stack */}
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-350 flex-wrap items-center justify-center gap-2 px-6 py-4 md:px-12">
          {TECH_STACK.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
