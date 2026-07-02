"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { TableOfContents } from "./toc";
import { EASE } from "./components";
import { DocsHero } from "./sections/hero";
import { DocsDemo } from "./sections/demo";
import { IntroductionSection } from "./sections/introduction";
import { GettingStartedSection } from "./sections/getting-started";
import { ArchitectureSection } from "./sections/architecture";
import { ConfigurationSection } from "./sections/configuration";
import { TransportSection } from "./sections/transport";
import { DevToolsSection } from "./sections/dev-tools";
import { BuiltinToolsSection } from "./sections/builtin-tools";
import { BackendIntegrationSection } from "./sections/backend-integration";
import { CustomizationSection } from "./sections/customization";
import { DocsFooter } from "./sections/footer";

const SECTIONS = [
  IntroductionSection,
  GettingStartedSection,
  ArchitectureSection,
  ConfigurationSection,
  TransportSection,
  DevToolsSection,
  BuiltinToolsSection,
  BackendIntegrationSection,
  CustomizationSection,
];

export function DocsContent() {
  const reduce = useReducedMotion();

  return (
    <div className="relative min-h-dvh bg-background pb-24 text-foreground selection:bg-primary/15">
      {/* Subtle top wash tied to the theme accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-105 bg-linear-to-b from-primary/5 to-transparent"
      />

      <DocsHero />

      <main className="relative z-10 mx-auto mt-14 flex max-w-350 items-start gap-12 px-6 md:px-12">
        <div className="w-full min-w-0 max-w-5xl flex-1">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <DocsDemo />
          </motion.div>

          {SECTIONS.map((Section, i) => (
            <React.Fragment key={i}>
              <div className="my-20 h-px w-full bg-border/60" />
              <Section />
            </React.Fragment>
          ))}
        </div>

        <aside className="sticky top-24 hidden w-56 shrink-0 lg:block">
          <TableOfContents />
        </aside>
      </main>

      <DocsFooter />
    </div>
  );
}
