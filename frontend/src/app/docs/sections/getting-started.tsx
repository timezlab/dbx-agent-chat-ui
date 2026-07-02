"use client";

import * as React from "react";
import { TerminalIcon } from "lucide-react";
import { CodeBlock } from "../code-block";
import { DocsSection, InlineCode, SectionLead, Step } from "../components";

export function GettingStartedSection() {
  return (
    <DocsSection
      id="getting-started"
      icon={<TerminalIcon className="size-4" />}
      title="Getting Started"
    >
      <SectionLead>
        The project uses <InlineCode>pnpm</InlineCode> as the package manager
        and targets static export for deployment.
      </SectionLead>

      <div className="mt-8 space-y-8">
        <Step index={1} title="Clone and install">
          <CodeBlock language="bash">
            {`git clone https://github.com/timezlab/dbx-agent-chat-ui.git
cd dbx-agent-chat-ui/frontend
pnpm install`}
          </CodeBlock>
        </Step>

        <Step index={2} title="Run locally (dev mode)">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            The local development environment uses an integrated Mock API
            route. You only need one terminal.
          </p>
          <CodeBlock title="Terminal" language="bash">
            {`cd frontend
pnpm dev`}
          </CodeBlock>
        </Step>

        <Step index={3} title="Production build" isLast>
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            To create a static production build, run the appropriate build
            script:
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CodeBlock title="Manual Build" language="bash">
              {`cd frontend
pnpm build:manual`}
            </CodeBlock>
            <CodeBlock title="Embed Build" language="bash">
              {`cd frontend
pnpm build:embed`}
            </CodeBlock>
          </div>
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            The final compiled output will be packaged in the repository root
            as <InlineCode>manual.zip</InlineCode> or{" "}
            <InlineCode>embed.html</InlineCode>, ready for deployment.
          </p>
        </Step>
      </div>
    </DocsSection>
  );
}
