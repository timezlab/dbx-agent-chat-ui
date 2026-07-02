"use client";

import * as React from "react";
import { BellRingIcon, FlaskConicalIcon } from "lucide-react";
import { DocCard, DocsSection, SectionLead } from "../components";

export function DevToolsSection() {
  return (
    <DocsSection
      id="dev-tools"
      icon={<FlaskConicalIcon className="size-4" />}
      title="Dev Tools"
    >
      <SectionLead>
        The UI includes built-in developer utilities for UI styling and
        integration testing without requiring a real backend.
      </SectionLead>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DocCard
          icon={<FlaskConicalIcon className="size-4" />}
          title="Dev Tools & Replay Mode"
          desc="Set NEXT_PUBLIC_DEV_TOOLS=1. A Flask icon in the sidebar lets you toggle 'Replay Mode' to play recorded SSE streams client-side (no backend needed), perfect for UI testing."
        />
        <DocCard
          icon={<BellRingIcon className="size-4" />}
          title="Test Toasts"
          desc="The Dev Tools menu also includes buttons to trigger sample persistent error toasts, helping you verify that stream failure scenarios render correctly without forcing a backend failure."
        />
      </div>
    </DocsSection>
  );
}
