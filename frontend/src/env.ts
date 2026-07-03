import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/** An absolute URL (real agent / proxy) or a same-origin path like `/api/chat`.
 *  Same-origin paths let the browser stream without CORS and let one static build
 *  serve any mount point (resolved against the base path at runtime by
 *  `resolveDeploymentUrl`). Used for every host endpoint, not just chat. */
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
    NEXT_PUBLIC_HISTORY_API_URL: endpointUrl.optional(),

    // Host-provided REST endpoint for reply feedback (thumbs + comment). Unset ⇒
    // no-op/local mock sink. Failures are non-blocking.
    NEXT_PUBLIC_FEEDBACK_API_URL: endpointUrl.optional(),

    // Host-provided REST endpoint listing selectable agents (id + name). Unset /
    // failure / empty ⇒ agent selector hidden, default endpoint used.
    NEXT_PUBLIC_AGENTS_API_URL: endpointUrl.optional(),

    // Host-provided REST endpoint returning the current user's identity (email +
    // username required; user_id/session_id/auth_type/org_id optional). Unset / failure
    // / missing required field ⇒ identity chip hidden. Display-only; no secret in bundle.
    NEXT_PUBLIC_ME_API_URL: endpointUrl.optional(),

    // Empty-state sample prompts, as a JSON array of strings (e.g.
    // `["Summarize this","Write a SQL query"]`). Parsed in lib/config; malformed
    // JSON degrades to no samples. Kept as a raw string here (JSON, not a URL).
    NEXT_PUBLIC_SAMPLE_PROMPTS: z.string().optional(),

    // Toggle the composer's attach/upload affordance. Any of "1"/"true"/"yes"
    // (case-insensitive) enables it; unset / anything else ⇒ disabled (default).
    NEXT_PUBLIC_ENABLE_UPLOAD: z.string().optional(),

    // Comma-separated accept list for the file picker (mime patterns and/or
    // extensions, e.g. "image/*,application/pdf,.csv"). Parsed in lib/config; unset
    // or blank ⇒ images only (DEFAULT_UPLOAD_ACCEPT).
    NEXT_PUBLIC_UPLOAD_ACCEPT: z.string().optional(),

    // Max size per attached file, in MB. Parsed in lib/config; unset/invalid ⇒ the
    // built-in default (see MAX_ATTACHMENT_SIZE_BYTES in lib/chat/attachments.ts).
    NEXT_PUBLIC_UPLOAD_MAX_SIZE_MB: z.string().optional(),

    // Toggle the developer/test **Dev tools** entry (and therefore Replay mode). Any of
    // "1"/"true"/"yes" (case-insensitive) enables it; unset / anything else ⇒ off
    // (default). A non-secret build/deploy-time selector (Principle II) — a demo deploy
    // sets it, a customer-facing deploy leaves it off. See FR-026.
    NEXT_PUBLIC_DEV_TOOLS: z.string().optional(),

    // Host-provided REST endpoint for documentation link. Unset ⇒ hides docs icon.
    NEXT_PUBLIC_DOCS_URL: endpointUrl.optional(),

    // Host-provided REST endpoint for welcome/landing page. Unset ⇒ hides welcome icon.
    NEXT_PUBLIC_WELCOME_URL: endpointUrl.optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_CHAT_ENDPOINT_URL: process.env.NEXT_PUBLIC_CHAT_ENDPOINT_URL,
    NEXT_PUBLIC_HISTORY_API_URL: process.env.NEXT_PUBLIC_HISTORY_API_URL,
    NEXT_PUBLIC_FEEDBACK_API_URL: process.env.NEXT_PUBLIC_FEEDBACK_API_URL,
    NEXT_PUBLIC_AGENTS_API_URL: process.env.NEXT_PUBLIC_AGENTS_API_URL,
    NEXT_PUBLIC_ME_API_URL: process.env.NEXT_PUBLIC_ME_API_URL,
    NEXT_PUBLIC_SAMPLE_PROMPTS: process.env.NEXT_PUBLIC_SAMPLE_PROMPTS,
    NEXT_PUBLIC_ENABLE_UPLOAD: process.env.NEXT_PUBLIC_ENABLE_UPLOAD,
    NEXT_PUBLIC_UPLOAD_ACCEPT: process.env.NEXT_PUBLIC_UPLOAD_ACCEPT,
    NEXT_PUBLIC_UPLOAD_MAX_SIZE_MB: process.env.NEXT_PUBLIC_UPLOAD_MAX_SIZE_MB,
    NEXT_PUBLIC_DEV_TOOLS: process.env.NEXT_PUBLIC_DEV_TOOLS,
    NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,
    NEXT_PUBLIC_WELCOME_URL: process.env.NEXT_PUBLIC_WELCOME_URL,
  },
  // Treat an empty-string env var (e.g. `NEXT_PUBLIC_CHAT_ENDPOINT_URL=` from a
  // docker-compose default) as unset, so an unconfigured deployment falls back to
  // the "no endpoint" inline notice instead of failing `.url()` validation.
  emptyStringAsUndefined: true,
});
