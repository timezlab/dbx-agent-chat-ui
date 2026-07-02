"use client";

import * as React from "react";
import { CodeIcon, LockIcon, SparklesIcon } from "lucide-react";
import { DocCard, DocsSection, SectionLead } from "../components";

export function IntroductionSection() {
  return (
    <DocsSection
      id="introduction"
      icon={<SparklesIcon className="size-4" />}
      title="Introduction"
    >
      <SectionLead>
        <strong className="text-foreground">dbx-agent-chat-ui</strong> is a
        reusable, UI-only frontend chat application purpose-built for
        interacting with Databricks AI Agents.
      </SectionLead>
      <SectionLead>
        Instead of building a full-stack monolith, this project focuses
        strictly on the presentation layer. It generates a single static
        HTML/JS export that can be hosted anywhere: notebook proxies,
        Databricks Apps, or even an S3 bucket.
      </SectionLead>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <DocCard
          icon={<CodeIcon className="size-4" />}
          title="UI-Only Frontier"
          desc="No backend or middleware. It communicates directly via Server-Sent Events (SSE) with your chosen LLM endpoint."
        />
        <DocCard
          icon={<LockIcon className="size-4" />}
          title="Zero Credential Risk"
          desc="Because it's purely static, no secrets or API keys are stored in the bundle, making it inherently secure for enterprise environments."
        />
      </div>
    </DocsSection>
  );
}
