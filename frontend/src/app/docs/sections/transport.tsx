"use client";

import * as React from "react";
import { RadioTowerIcon } from "lucide-react";
import { DocsSection, InlineCode, SectionLead } from "../components";

export function TransportSection() {
  return (
    <DocsSection
      id="transport"
      icon={<RadioTowerIcon className="size-4" />}
      title="Chat Transport & Streaming"
    >
      <SectionLead>
        The UI talks to Databricks agent endpoints using a single transport
        abstraction. There are no transport &quot;modes&quot;; the UI streams
        from one endpoint speaking the Databricks Playground SSE format.
      </SectionLead>

      <div className="mt-6 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
        <div className="p-5">
          <h4 className="mb-2 font-medium tracking-tight text-foreground">
            Streaming via Fetch-Event-Source
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We use <InlineCode>@microsoft/fetch-event-source</InlineCode> to
            support POST SSE, custom headers, and request bodies. The stream
            reducer handles optimistic updates, parses tool timelines, and
            manages stream abortion natively.
          </p>
        </div>

        <div className="p-5">
          <h4 className="mb-2 font-medium tracking-tight text-foreground">
            Auto-Retry Connection Recovery
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            To handle transient network drops or proxy timeouts (like
            FastAPI&apos;s aggressive keep-alive limits), the transport
            includes an auto-retry mechanism. It will silently attempt to
            reconnect up to <strong className="text-foreground">3 times</strong>{" "}
            (with a 2s delay) upon unexpected disconnects before surfacing an
            error to the user.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Backend Integration:</strong>{" "}
            To support seamless resumption, your backend must include an{" "}
            <InlineCode>id</InlineCode> field in its SSE events (e.g.,{" "}
            <InlineCode>id: msg_123</InlineCode>). During a retry, the UI
            automatically re-sends the original POST request along with a{" "}
            <InlineCode>Last-Event-ID</InlineCode> header containing the last
            received ID. Your backend should parse this header and resume the
            stream from that point rather than restarting the generation.
          </p>
        </div>

        <div className="p-5">
          <h4 className="mb-2 font-medium tracking-tight text-foreground">
            Markdown & Code via Streamdown
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Assistant replies are rendered using{" "}
            <InlineCode>streamdown</InlineCode>, transforming markdown, code
            blocks, and tables into structured UI. Tool calls and traces are
            intercepted and rendered as distinct Timeline components rather
            than raw markdown.
          </p>
        </div>
      </div>
    </DocsSection>
  );
}
