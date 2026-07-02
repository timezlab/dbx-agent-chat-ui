"use client";

import * as React from "react";
import { CodeIcon, LayersIcon, LockIcon, TerminalIcon } from "lucide-react";
import { DocCard, DocsSection, SectionLead } from "../components";

export function ArchitectureSection() {
  return (
    <DocsSection
      id="architecture"
      icon={<LayersIcon className="size-4" />}
      title="Architecture & Boundaries"
    >
      <SectionLead>
        This repository provides a reusable chat UI, not a backend runtime. It
        is designed to deploy to constrained targets (notebooks, proxy hosting)
        serving only static files, as well as richer wrappers like Databricks
        Apps. To maintain this flexibility and ensure Databricks secrets never
        leak to the browser, the repository enforces strict boundaries.
      </SectionLead>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DocCard
          icon={<TerminalIcon className="size-4" />}
          title="Static Export (D-002)"
          desc="Built with Next.js output: 'export'. No Node.js runtime, route handlers, or server actions are allowed in the shared UI."
        />
        <DocCard
          icon={<CodeIcon className="size-4" />}
          title="UI-Only (D-003)"
          desc="No BFF, API proxy, or credential handling exists here. Data fetching is isolated to client-side adapters."
        />
        <DocCard
          icon={<LockIcon className="size-4" />}
          title="Auth Outside Scope (D-013)"
          desc="Authentication (OAuth, PATs, Service Principals) is strictly handled by the deployment wrapper, never the frontend."
        />
      </div>
    </DocsSection>
  );
}
