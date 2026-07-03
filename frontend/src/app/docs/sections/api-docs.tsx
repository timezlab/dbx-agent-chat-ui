"use client";

import * as React from "react";
import { PlugIcon } from "lucide-react";
import { CodeBlock } from "../code-block";
import { DocsSection, InlineCode, SectionLead } from "../components";

/** One documented endpoint: method + path header, a note, and a response example. */
function Endpoint({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="flex flex-wrap items-center gap-2 text-base font-medium tracking-tight">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
          {method}
        </span>
        <span className="font-mono text-sm text-foreground">{path}</span>
      </h3>
      {children}
    </div>
  );
}

const CHAT_REQUEST = `POST {NEXT_PUBLIC_CHAT_ENDPOINT_URL}
Content-Type: application/json

{
  "messages": [{ "role": "user", "content": "Hello" }],
  "agentId": "agent-123"        // optional; omitted for default routing
}`;

const CHAT_SSE = `Content-Type: text/event-stream

data: {"type": "response.output_text.delta", "delta": "Hello"}

data: {"type": "response.output_item.done", "item": { ... }}

data: {"type": "response.completed"}`;

const HISTORY_LIST = `GET {NEXT_PUBLIC_HISTORY_API_URL}      // e.g. /api/history

{
  "conversations": [
    {
      "id": "conv-delta-sql",
      "title": "How do I read a Delta table with SQL?",
      "updatedAt": 1735732865000,   // epoch ms; list is sorted newest-first
      "messageCount": 4
    }
  ]
}`;

const HISTORY_DETAIL = `GET {NEXT_PUBLIC_HISTORY_API_URL}/{id}   // e.g. /api/history/conv-delta-sql

{
  "conversation": {
    "id": "conv-delta-sql",
    "status": "idle",
    "activeId": null,
    "queue": [],
    "messages": [
      {
        "id": "c1-m2",
        "role": "assistant",             // "user" | "assistant"
        "status": "complete",
        "parts": [{ "type": "text", "text": "Query it by name: ..." }],
        "attachments": [],
        "error": null,
        "createdAt": 1735732805000,
        "feedback": {                    // null until rated (assistant turns only)
          "rating": "up",               // "up" | "down"
          "comment": "Exactly what I needed.",   // optional
          "submittedAt": 1735732820000           // optional, epoch ms
        }
      }
    ]
  }
}`;

const FEEDBACK = `POST {NEXT_PUBLIC_FEEDBACK_API_URL}    // e.g. /api/feedback
Content-Type: application/json

// Request body
{
  "messageId": "c1-m2",
  "rating": "up",          // "up" | "down"
  "comment": "Helpful!"    // optional free text
}

// Response — any 2xx; feedback is never a blocking gate
{ "ok": true }`;

const AGENTS = `GET {NEXT_PUBLIC_AGENTS_API_URL}       // e.g. /api/agents

{
  "agents": [
    { "id": "agent-123", "name": "SQL Analyst" },
    { "id": "agent-456", "name": "Docs Assistant" }
  ]
}`;

const ME = `GET {NEXT_PUBLIC_ME_API_URL}           // e.g. /api/me

{
  "email": "dai.le@timezlab.org",   // required
  "username": "dai.le",             // required
  "user_id": "u-8f3a1c92",          // optional
  "session_id": "sess-4b7e",        // optional
  "auth_type": "DB_SAML_SSO",       // optional: "DB_SAML_SSO" | "PAT"
  "org_id": "org-1024"              // optional
}`;

export function ApiDocsSection() {
  return (
    <DocsSection
      id="api-docs"
      icon={<PlugIcon className="size-4" />}
      title="API Reference (Expected Formats)"
    >
      <SectionLead>
        Every backend is reached through a <InlineCode>ChatTransport</InlineCode>{" "}
        or a capability provider — the UI never hard-codes a URL. This is the exact
        request/response contract each configured endpoint must satisfy. All reads
        are sent with <InlineCode>credentials: &quot;include&quot;</InlineCode>{" "}
        (same-origin cookies); no secret ever lives in the bundle.
      </SectionLead>

      <div className="mt-8 space-y-10">
        <Endpoint method="POST" path="{CHAT_ENDPOINT_URL}">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            The core chat stream. Posts the running message list and streams the
            reply back as Server-Sent Events (Databricks Playground frames). See{" "}
            <InlineCode>Backend Integration</InlineCode> for the full event grammar.
          </p>
          <CodeBlock title="Request" language="json" wrap>
            {CHAT_REQUEST}
          </CodeBlock>
          <CodeBlock title="Response (SSE)" language="bash" wrap>
            {CHAT_SSE}
          </CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="{HISTORY_API_URL}">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            Lists past conversations for the sidebar (summaries only). Unset ⇒ the
            UI falls back to <InlineCode>localStorage</InlineCode>. Persisting
            conversations is the backend&apos;s responsibility — the UI only reads.
          </p>
          <CodeBlock title="Response" language="json" wrap>
            {HISTORY_LIST}
          </CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="{HISTORY_API_URL}/{id}">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            Returns one full conversation, fetched when the user opens it. Each
            assistant message carries its own <InlineCode>feedback</InlineCode>{" "}
            object (rating + optional comment), so a restored reply shows the saved
            thumbs and note.
          </p>
          <CodeBlock title="Response" language="json" wrap collapsible previewLines={12}>
            {HISTORY_DETAIL}
          </CodeBlock>
        </Endpoint>

        <Endpoint method="POST" path="{FEEDBACK_API_URL}">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            Records a thumbs up/down (and optional comment) for one assistant reply.
            Unset ⇒ a no-op sink. A rejection is non-blocking — the selection is
            kept and surfaces a quiet notice.
          </p>
          <CodeBlock title="Request / Response" language="json" wrap>
            {FEEDBACK}
          </CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="{AGENTS_API_URL}">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            Populates the agent selector. An empty list (or unset URL, or a failed
            fetch) hides the selector and uses default routing.
          </p>
          <CodeBlock title="Response" language="json" wrap>
            {AGENTS}
          </CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="{ME_API_URL}">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            Identifies the current user for the sidebar chip.{" "}
            <InlineCode>email</InlineCode> and <InlineCode>username</InlineCode>{" "}
            are required; the rest are optional. Unset or a failed fetch shows an
            anonymous placeholder.
          </p>
          <CodeBlock title="Response" language="json" wrap>
            {ME}
          </CodeBlock>
        </Endpoint>
      </div>
    </DocsSection>
  );
}
