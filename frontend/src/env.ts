import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/** An absolute URL (real agent / proxy) or a same-origin path like `/api/chat` (the
 *  dev mock route). Same-origin paths let the browser stream without CORS. */
const endpointUrl = z
  .string()
  .refine((v) => v.startsWith("/") || URL.canParse(v), {
    message: "Must be an absolute URL or a same-origin path starting with '/'",
  });

export const env = createEnv({
  client: {
    // The single chat endpoint the UI streams from — a Databricks Playground-format
    // SSE endpoint (real agent, proxy, the dev same-origin mock route `/api/chat`, or
    // the standalone mock-api script; the UI can't tell them apart). Unset ⇒ notice.
    NEXT_PUBLIC_CHAT_ENDPOINT_URL: endpointUrl.optional(),

    // Host-provided REST endpoint for conversation history. Unset ⇒ localStorage
    // (degrading to in-memory). This repo owns no history backend (Principle I).
    NEXT_PUBLIC_HISTORY_API_URL: z.string().url().optional(),

    // Host-provided REST endpoint for reply feedback (thumbs + comment). Unset ⇒
    // no-op/local mock sink. Failures are non-blocking.
    NEXT_PUBLIC_FEEDBACK_API_URL: z.string().url().optional(),

    // Host-provided REST endpoint listing selectable agents (id + name). Unset /
    // failure / empty ⇒ agent selector hidden, default endpoint used.
    NEXT_PUBLIC_AGENTS_API_URL: z.string().url().optional(),

    // Empty-state sample prompts, as a JSON array of strings (e.g.
    // `["Summarize this","Write a SQL query"]`). Parsed in lib/config; malformed
    // JSON degrades to no samples. Kept as a raw string here (JSON, not a URL).
    NEXT_PUBLIC_SAMPLE_PROMPTS: z.string().optional(),

    // Toggle the composer's attach/upload affordance. Any of "1"/"true"/"yes"
    // (case-insensitive) enables it; unset / anything else ⇒ disabled (default).
    // Upload itself is still deferred — enabling only shows the (no-op) button.
    NEXT_PUBLIC_ENABLE_UPLOAD: z.string().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_CHAT_ENDPOINT_URL: process.env.NEXT_PUBLIC_CHAT_ENDPOINT_URL,
    NEXT_PUBLIC_HISTORY_API_URL: process.env.NEXT_PUBLIC_HISTORY_API_URL,
    NEXT_PUBLIC_FEEDBACK_API_URL: process.env.NEXT_PUBLIC_FEEDBACK_API_URL,
    NEXT_PUBLIC_AGENTS_API_URL: process.env.NEXT_PUBLIC_AGENTS_API_URL,
    NEXT_PUBLIC_SAMPLE_PROMPTS: process.env.NEXT_PUBLIC_SAMPLE_PROMPTS,
    NEXT_PUBLIC_ENABLE_UPLOAD: process.env.NEXT_PUBLIC_ENABLE_UPLOAD,
  },
  // Treat an empty-string env var (e.g. `NEXT_PUBLIC_CHAT_ENDPOINT_URL=` from a
  // docker-compose default) as unset, so an unconfigured deployment falls back to
  // the "no endpoint" inline notice instead of failing `.url()` validation.
  emptyStringAsUndefined: true,
});
