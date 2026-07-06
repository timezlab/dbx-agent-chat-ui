"use client";

import * as React from "react";
import { SettingsIcon } from "lucide-react";
import { CodeBlock } from "../code-block";
import { DocsSection, InlineCode, SectionLead } from "../components";

const ENV_EXAMPLE = `# [REQUIRED] Core Chat Endpoint
NEXT_PUBLIC_CHAT_ENDPOINT_URL=/api/chat

# [OPTIONAL] Host-provided REST endpoints
NEXT_PUBLIC_HISTORY_API_URL=/api/history
NEXT_PUBLIC_FEEDBACK_API_URL=/api/feedback
NEXT_PUBLIC_AGENTS_API_URL=/api/agents

# [OPTIONAL] Identity endpoint (GET -> current user)
NEXT_PUBLIC_ME_API_URL=/api/me

# [OPTIONAL] Empty-state sample prompts (JSON Array)
NEXT_PUBLIC_SAMPLE_PROMPTS='["Analyze data", "Write SQL"]'

# [OPTIONAL] Feature Toggles ("1"/"true"/"yes")
NEXT_PUBLIC_ENABLE_UPLOAD=true
NEXT_PUBLIC_DEV_TOOLS=1

# [OPTIONAL] Usage/metrics footer — shown by default; opt OUT with "false"/"0"/"no"/"off"
NEXT_PUBLIC_SHOW_USAGE=false

# [OPTIONAL] Navigation Links
NEXT_PUBLIC_DOCS_URL=/docs
NEXT_PUBLIC_WELCOME_URL=/welcome`;

export function ConfigurationSection() {
  return (
    <DocsSection
      id="configuration"
      icon={<SettingsIcon className="size-4" />}
      title="Configuration (Environment Variables)"
    >
      <SectionLead>
        The UI&apos;s behavior and endpoint routing are determined purely by
        public configuration (<InlineCode>NEXT_PUBLIC_*</InlineCode>). Create a{" "}
        <InlineCode>.env</InlineCode> file in the{" "}
        <InlineCode>frontend/</InlineCode> directory.
      </SectionLead>

      <CodeBlock title="frontend/.env" language="env" codeString={ENV_EXAMPLE}>
        {ENV_EXAMPLE}
      </CodeBlock>

      <ul className="max-w-[70ch] list-outside list-disc space-y-3 pl-4 text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">Zero-Databricks Dev:</strong>{" "}
          Local development uses <InlineCode>/api/chat</InlineCode> (or{" "}
          <InlineCode>http://localhost:3000/api/chat</InlineCode>) to hit the
          internal mock API route.
        </li>
        <li>
          <strong className="text-foreground">Backend-only history:</strong> If the
          History API fails or is unset, the sidebar is simply empty — there is no{" "}
          <InlineCode>localStorage</InlineCode> fallback. The backend is the only store
          of record; the browser keeps just a small session pointer (which conversation
          was open).
        </li>
        <li>
          <strong className="text-foreground">Identity chip:</strong> Set{" "}
          <InlineCode>NEXT_PUBLIC_ME_API_URL</InlineCode> to a{" "}
          <InlineCode>GET</InlineCode> endpoint returning{" "}
          <InlineCode>{"{ email, username, user_id?, session_id?, auth_type?, org_id? }"}</InlineCode>{" "}
          (<InlineCode>email</InlineCode> + <InlineCode>username</InlineCode>{" "}
          required; <InlineCode>auth_type</InlineCode> is{" "}
          <InlineCode>DB_SAML_SSO</InlineCode> or <InlineCode>PAT</InlineCode>).
          It renders a read-only user chip in the sidebar footer; unset or a
          failed fetch shows an anonymous placeholder instead.
        </li>
        <li>
          <strong className="text-foreground">Usage &amp; metrics:</strong> Each reply
          shows a footer with response time, time-to-first-token, tokens, and cost.
          Time &amp; TTFT are measured in the browser (a realtime clock while streaming);
          tokens and cost come from the backend&apos;s{" "}
          <InlineCode>usage</InlineCode> frame (<InlineCode>cost_usd</InlineCode> is
          backend-computed — the UI never estimates it), and each tool row can show a
          backend <InlineCode>duration_ms</InlineCode>. Shown by default; set{" "}
          <InlineCode>NEXT_PUBLIC_SHOW_USAGE=false</InlineCode> to hide the whole footer.
        </li>
      </ul>
    </DocsSection>
  );
}
