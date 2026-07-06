"use client";

import * as React from "react";
import { ServerIcon } from "lucide-react";
import { CodeBlock } from "../code-block";
import { DocsSection, InlineCode, SectionLead } from "../components";

const FASTAPI_EXAMPLE = `from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import json
import asyncio

app = FastAPI()

# In-memory buffer for demonstration. In production, use Redis/DB.
# Structure: { "session_123": [{"payload": {...}}, ...] }
STREAM_BUFFER = {}
# Track active streams to know when to stop tailing
ACTIVE_STREAMS = set()

@app.post("/api/chat")
async def chat_endpoint(request: Request):
    # 1. Read Last-Event-ID to know where the client left off
    last_event_id = request.headers.get("Last-Event-ID")
    body = await request.json()
    session_id = body.get("session_id", "default")

    if session_id not in STREAM_BUFFER:
        STREAM_BUFFER[session_id] = []

    async def event_generator():
        buffered = STREAM_BUFFER[session_id]

        # 2. Reconnection Flow: tail the buffer in O(1) using the index
        if last_event_id and last_event_id.isdigit():
            # If SSE 'id' is the index, we jump directly to the next item
            current_idx = int(last_event_id) + 1

            while current_idx < len(buffered) or session_id in ACTIVE_STREAMS:
                if current_idx < len(buffered):
                    chunk = buffered[current_idx]
                    if chunk["payload"] is None:
                        yield "data: [DONE]\\n\\n"
                        return
                    yield f"id: {current_idx}\\ndata: {json.dumps(chunk['payload'])}\\n\\n"
                    current_idx += 1
                else:
                    await asyncio.sleep(0.1)

            yield "data: [DONE]\\n\\n"
            return

        # 3. Normal Flow: Streaming from an LLM provider
        ACTIVE_STREAMS.add(session_id)
        try:
            llm_stream = await llm_client.chat.completions.create(
                messages=body.get("messages", []),
                stream=True
            )

            async for chunk in llm_stream:
                payload = {
                    "type": "response.output_text.delta",
                    "delta": chunk.choices[0].delta.content or ""
                }

                # 4. Buffer chunk and use array length as the SSE \`id\`
                idx = len(buffered)
                buffered.append({"payload": payload})

                # 5. Yield standard SSE format WITH integer \`id\`
                yield f"id: {idx}\\ndata: {json.dumps(payload)}\\n\\n"

            # Push DONE marker
            buffered.append({"payload": None})
            yield "data: [DONE]\\n\\n"
        finally:
            ACTIVE_STREAMS.discard(session_id)

    return StreamingResponse(event_generator(), media_type="text/event-stream")`;

export function BackendIntegrationSection() {
  return (
    <DocsSection
      id="backend-integration"
      icon={<ServerIcon className="size-4" />}
      title="Backend Integration Guide"
    >
      <SectionLead>
        To build a backend compatible with this UI, you need to expose a{" "}
        <InlineCode>POST</InlineCode> endpoint (configured via{" "}
        <InlineCode>NEXT_PUBLIC_CHAT_ENDPOINT_URL</InlineCode>). The endpoint
        must return a Server-Sent Events (SSE) stream adhering to the{" "}
        <strong className="text-foreground">
          Databricks Playground / MLflow Responses format
        </strong>
        .
      </SectionLead>

      <div className="mt-6 space-y-10">
        <div>
          <h3 className="mb-3 text-lg font-medium tracking-tight">
            Event data types
          </h3>
          <p className="mb-4 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            Your SSE stream should send JSON payloads in the{" "}
            <InlineCode>data:</InlineCode> field with specific{" "}
            <InlineCode>type</InlineCode> values. The UI&apos;s parser
            specifically listens for the following events:
          </p>
          <ul className="max-w-[70ch] list-outside list-disc space-y-3 pl-4 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Text Tokens:</strong>{" "}
              <InlineCode>{`{"type": "response.output_text.delta", "delta": "Hello"}`}</InlineCode>
            </li>
            <li>
              <strong className="text-foreground">
                Reasoning Tokens (Optional):
              </strong>{" "}
              <InlineCode>{`{"type": "response.reasoning_text.delta", "delta": "Let me think..."}`}</InlineCode>
            </li>
            <li>
              <strong className="text-foreground">Tool Call Start:</strong>{" "}
              <InlineCode>{`{"type": "response.output_item.done", "item": {"type": "function_call", "call_id": "call_123", "name": "search", "arguments": "{}"}}`}</InlineCode>
            </li>
            <li>
              <strong className="text-foreground">Tool Call Result:</strong>{" "}
              <InlineCode>{`{"type": "response.output_item.done", "item": {"type": "function_call_output", "call_id": "call_123", "output": "Result string"}}`}</InlineCode>
              . Add an optional{" "}
              <InlineCode>&quot;duration_ms&quot;</InlineCode> to the output item
              to show that tool&apos;s run time on its row.
            </li>
            <li>
              <strong className="text-foreground">
                Usage &amp; Cost (Optional):
              </strong>{" "}
              <InlineCode>{`{"type": "response.completed", "response": {"usage": {"input_tokens": 100, "output_tokens": 50, "total_tokens": 150, "cost_usd": 0.002}}}`}</InlineCode>{" "}
              — powers the reply&apos;s tokens + cost footer.{" "}
              <InlineCode>cost_usd</InlineCode> is yours to compute (the UI never
              estimates it); response time &amp; time-to-first-token are measured in
              the browser. Emit it <em>before</em> the terminal{" "}
              <InlineCode>message</InlineCode> item (which closes the stream).
            </li>
            <li>
              <strong className="text-foreground">Error Handling:</strong>{" "}
              Send <InlineCode>{`{"error": "Message"}`}</InlineCode> on the
              final frame before closing.
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-lg font-medium tracking-tight">
            Generating SSE from an LLM & auto-retry
          </h3>
          <p className="mb-4 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            To support the UI&apos;s auto-reconnect feature, every SSE event
            must include an <InlineCode>id</InlineCode> field. When
            reconnecting, the UI sends the <InlineCode>Last-Event-ID</InlineCode>{" "}
            header. If you are proxying Databricks Model Serving, Databricks
            natively emits these IDs and buffers the stream. If you are
            building your own LLM integration, you must include an{" "}
            <InlineCode>id</InlineCode> and ideally buffer the stream (e.g. in
            Redis) to resume properly.
          </p>
          <CodeBlock
            title="Realistic LLM Backend Example (FastAPI)"
            language="python"
            collapsible
            previewLines={10}
          >
            {FASTAPI_EXAMPLE}
          </CodeBlock>
        </div>
      </div>
    </DocsSection>
  );
}
