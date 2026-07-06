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

// ---------------------------------------------------------------------------
// POST {CHAT_ENDPOINT_URL}
// ---------------------------------------------------------------------------

const CHAT_TYPES = `// Request body — POSTed as JSON to the chat endpoint.
type ChatRequest = {
  messages: ChatRequestMessage[];  // full history, oldest → newest
  conversationId?: string;         // stable per session — lets the backend group
                                   // turns into the conversation history serves back
  agentId?: string;                // only when the agents API is set AND one is
                                   // selected — omitted for default routing
};

type ChatRequestMessage = {
  role: "user" | "assistant";
  content: string;                 // assistant turns: text parts flattened to one string
  attachments?: Attachment[];      // ONLY on the turn being sent — replayed history
                                   // turns never carry them (payload would grow
                                   // exponentially per turn otherwise)
};

// A file the user attached, read client-side (FileReader → base64), shipped inline.
type Attachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;                    // bytes of the original file
  dataUrl: string;                 // "data:<mime>;base64,..."
};`;

const CHAT_REQUEST = `POST {NEXT_PUBLIC_CHAT_ENDPOINT_URL}
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! What can I do for you?" },
    {
      "role": "user",
      "content": "Summarize this file",
      "attachments": [{
        "id": "att-1",
        "name": "report.pdf",
        "mimeType": "application/pdf",
        "size": 48213,
        "dataUrl": "data:application/pdf;base64,..."
      }]
    }
  ],
  "conversationId": "conv-delta-sql",
  "agentId": "agent-123"
}`;

const CHAT_SSE = `Content-Type: text/event-stream

// Databricks Playground / MLflow ResponsesAgent frames (OpenAI Responses shape).
data: {"type": "response.output_text.delta", "delta": "Hello"}

data: {"type": "response.reasoning_text.delta", "delta": "Comparing options..."}

// A tool call: function_call announces it (running); the later function_call_output
// (paired by call_id) carries the result (done).
data: {"type": "response.output_item.done", "item": {"type": "function_call",
  "call_id": "c1", "name": "run_sql", "arguments": "{\\"query\\": \\"SELECT 1\\"}"}}

data: {"type": "response.output_item.done", "item": {"type": "function_call_output",
  "call_id": "c1", "output": "[{...rows...}]"}}

// TERMINAL — the "message" item closes the turn (text already streamed via the
// deltas above is NOT re-read from it).
data: {"type": "response.output_item.done", "item": {"type": "message", ...}}

data: [DONE]     // also accepted as a terminal sentinel

// Errors: {"databricks_output": {"error": "..."}} or {"error": "..."} on any frame.
// Lifecycle / unknown frame types (e.g. response.completed) are ignored.`;

// ---------------------------------------------------------------------------
// GET {HISTORY_API_URL}
// ---------------------------------------------------------------------------

const HISTORY_LIST_TYPES = `// Paginated envelope — fetched one page at a time (increment page) for
// infinite scroll.
type ConversationPage = {
  items: ConversationSummary[];   // newest-first
  page: number;
  per_page: number;
  total: number;
};

// One sidebar row — enough to render + select; the full turns are fetched
// on demand when the user opens the conversation.
type ConversationSummary = {
  id: string;
  title: string;                  // first user line (or "New chat")
  updatedAt: number;              // epoch ms of the last turn; sorts newest-first
  messageCount: number;
};`;

const HISTORY_LIST = `GET {NEXT_PUBLIC_HISTORY_API_URL}?page=1&per_page=20   // e.g. /api/history

{
  "items": [
    {
      "id": "conv-delta-sql",
      "title": "How do I read a Delta table with SQL?",
      "updatedAt": 1735732865000,
      "messageCount": 4
    }
  ],
  "page": 1,
  "per_page": 20,
  "total": 42
}`;

// ---------------------------------------------------------------------------
// GET {HISTORY_API_URL}/{id}
// ---------------------------------------------------------------------------

const HISTORY_DETAIL_TYPES = `// The conversation object directly (200), or 404 when the id is unknown —
// no wrapper. Only id + messages: the client's streaming state machine
// (which turn is active, the send queue, idle/streaming) is runtime-only and
// never part of what the backend stores or returns.
type Conversation = {
  id: string;
  messages: Message[];            // oldest → newest
};

// One conversation turn.
type Message = {
  id: string;
  role: "user" | "assistant";
  // Stored turns only ever carry a terminal status; "queued" / "streaming" are
  // live in-session states.
  status: "queued" | "streaming" | "complete" | "stopped" | "error";
  parts: MessagePart[];               // stream-ordered — see MessagePart below
  attachments: Attachment[];          // user turns only (assistant always []);
                                      // Attachment — see the chat request types
  error: string | null;               // assistant only; the stream's error message
  feedback: MessageFeedback | null;   // assistant only; null until rated
  createdAt: number;                  // epoch ms; orders turns within a conversation
};

// Parts preserve the exact stream order (text ↔ tools ↔ reasoning interleaved),
// so a restored turn replays the same activity timeline the live stream showed.
// A user message is always a single text part.
type MessagePart =
  | { type: "text"; text: string }        // one contiguous markdown run
  | { type: "reasoning"; text: string }   // "thinking" channel — separate from text
  | { type: "tools"; items: ToolActivityItem[] };  // one run of consecutive tool calls

type ToolActivityItem = {
  id: string;                             // = call_id; pairs running ↔ done
  name: string;                           // raw tool id (e.g. "run_sql"), not a label
  args: Record<string, unknown> | null;   // parsed arguments, or null
  detail: string | null;                  // tool output; null while still running
  status: "running" | "done";
};

type MessageFeedback = {
  rating: "up" | "down";
  comment?: string;                       // optional free text
  submittedAt?: number;                   // optional, epoch ms of the last submit
};`;

const HISTORY_DETAIL = `GET {NEXT_PUBLIC_HISTORY_API_URL}/{id}   // e.g. /api/history/conv-delta-sql

{
  "id": "conv-delta-sql",
  "messages": [
    {
      "id": "c1-m1",
      "role": "user",
      "status": "complete",
      "parts": [{ "type": "text", "text": "How do I read a Delta table with SQL?" }],
      "attachments": [],
      "error": null,
      "feedback": null,
      "createdAt": 1735732800000
    },
    {
      "id": "c1-m2",
      "role": "assistant",
      "status": "complete",
      "parts": [
        { "type": "reasoning", "text": "The user wants the table by name..." },
        { "type": "tools", "items": [{
            "id": "call-1",
            "name": "run_sql",
            "args": { "query": "SELECT * FROM main.sales.orders LIMIT 5" },
            "detail": "[{...rows...}]",
            "status": "done"
        }] },
        { "type": "text", "text": "Query it by name: ..." }
      ],
      "attachments": [],
      "error": null,
      "createdAt": 1735732805000,
      "feedback": {
        "rating": "up",
        "comment": "Exactly what I needed.",
        "submittedAt": 1735732820000
      }
    }
  ]
}`;

// ---------------------------------------------------------------------------
// POST {FEEDBACK_API_URL}
// ---------------------------------------------------------------------------

const FEEDBACK_TYPES = `// Request body. Response: any 2xx (body ignored) — feedback is never a
// blocking gate.
type Feedback = {
  messageId: string;       // the rated assistant message
  rating: "up" | "down";
  comment?: string;        // optional free text
};`;

const FEEDBACK = `POST {NEXT_PUBLIC_FEEDBACK_API_URL}    // e.g. /api/feedback
Content-Type: application/json

{
  "messageId": "c1-m2",
  "rating": "up",
  "comment": "Helpful!"
}`;

// ---------------------------------------------------------------------------
// GET {AGENTS_API_URL}
// ---------------------------------------------------------------------------

const AGENTS_TYPES = `type AgentListResponse = {
  agents: Agent[];         // [] (or unset URL, or a failed fetch) hides the selector
};

type Agent = {
  id: string;              // sent as ChatRequest.agentId when selected
  name: string;            // label shown in the selector
};`;

const AGENTS = `GET {NEXT_PUBLIC_AGENTS_API_URL}       // e.g. /api/agents

{
  "agents": [
    { "id": "agent-123", "name": "SQL Analyst" },
    { "id": "agent-456", "name": "Docs Assistant" }
  ]
}`;

// ---------------------------------------------------------------------------
// GET {ME_API_URL}
// ---------------------------------------------------------------------------

const ME_TYPES = `// email + username are REQUIRED; the rest are optional — a missing field
// simply isn't rendered on the chip.
type Identity = {
  email: string;
  username: string;
  user_id?: string;
  session_id?: string;
  auth_type?: "DB_SAML_SSO" | "PAT";
  org_id?: string;
};`;

const ME = `GET {NEXT_PUBLIC_ME_API_URL}           // e.g. /api/me

{
  "email": "dai.le@timezlab.org",
  "username": "dai.le",
  "user_id": "u-8f3a1c92",
  "session_id": "sess-4b7e",
  "auth_type": "DB_SAML_SSO",
  "org_id": "org-1024"
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
        request/response contract each configured endpoint must satisfy: the{" "}
        <InlineCode>Types</InlineCode> block is the contract, the example shows it
        on the wire. All reads are sent with{" "}
        <InlineCode>credentials: &quot;include&quot;</InlineCode>{" "}
        (same-origin cookies); no secret ever lives in the bundle.
      </SectionLead>

      <div className="mt-8 space-y-10">
        <Endpoint method="POST" path="{CHAT_ENDPOINT_URL}">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            The core chat stream. Posts the running message list — plus a stable{" "}
            <InlineCode>conversationId</InlineCode> so the backend can group turns
            into the conversation that history later serves back, and the selected{" "}
            <InlineCode>agentId</InlineCode> when one is chosen — and streams the
            reply back as Server-Sent Events (Databricks Playground frames).
            Attachments ride only on the turn being sent; replayed history turns
            never carry them. See <InlineCode>Backend Integration</InlineCode> for
            the full event grammar.
          </p>
          <CodeBlock title="Types" language="typescript" wrap>
            {CHAT_TYPES}
          </CodeBlock>
          <CodeBlock title="Request example" language="json" wrap>
            {CHAT_REQUEST}
          </CodeBlock>
          <CodeBlock title="Response example (SSE)" language="bash" wrap>
            {CHAT_SSE}
          </CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="{HISTORY_API_URL}">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            Lists past conversations for the sidebar (summaries only), paginated via{" "}
            <InlineCode>page</InlineCode> / <InlineCode>per_page</InlineCode> and
            fetched one page at a time for infinite scroll. Unset ⇒ the sidebar is
            simply empty — there is <strong>no</strong>{" "}
            <InlineCode>localStorage</InlineCode> fallback. Persisting conversations is
            the backend&apos;s responsibility — the UI only reads.
          </p>
          <CodeBlock title="Types" language="typescript" wrap>
            {HISTORY_LIST_TYPES}
          </CodeBlock>
          <CodeBlock title="Response example" language="json" wrap>
            {HISTORY_LIST}
          </CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="{HISTORY_API_URL}/{id}">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            Returns one full conversation, fetched when the user opens it.{" "}
            <InlineCode>Message.parts</InlineCode> preserves the stream order
            (text, tool runs, reasoning interleaved) so a restored turn replays
            the same activity timeline, and each assistant message carries its own{" "}
            <InlineCode>feedback</InlineCode> object (rating + optional comment),
            so a restored reply shows the saved thumbs and note.
          </p>
          <CodeBlock
            title="Types"
            language="typescript"
            wrap
            collapsible
            previewLines={12}
          >
            {HISTORY_DETAIL_TYPES}
          </CodeBlock>
          <CodeBlock
            title="Response example"
            language="json"
            wrap
            collapsible
            previewLines={12}
          >
            {HISTORY_DETAIL}
          </CodeBlock>
        </Endpoint>

        <Endpoint method="POST" path="{FEEDBACK_API_URL}">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            Records a thumbs up/down (and optional comment) for one assistant reply.
            Unset ⇒ a no-op sink. A rejection is non-blocking — the selection is
            kept and surfaces a quiet notice.
          </p>
          <CodeBlock title="Types" language="typescript" wrap>
            {FEEDBACK_TYPES}
          </CodeBlock>
          <CodeBlock title="Request example" language="json" wrap>
            {FEEDBACK}
          </CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="{AGENTS_API_URL}">
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            Populates the agent selector. An empty list (or unset URL, or a failed
            fetch) hides the selector and uses default routing.
          </p>
          <CodeBlock title="Types" language="typescript" wrap>
            {AGENTS_TYPES}
          </CodeBlock>
          <CodeBlock title="Response example" language="json" wrap>
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
          <CodeBlock title="Types" language="typescript" wrap>
            {ME_TYPES}
          </CodeBlock>
          <CodeBlock title="Response example" language="json" wrap>
            {ME}
          </CodeBlock>
        </Endpoint>
      </div>
    </DocsSection>
  );
}
