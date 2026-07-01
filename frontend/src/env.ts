import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    // URL of the chat backend endpoint (notebook proxy, Databricks Apps, or gateway).
    // Leave unset to default to mock transport during local development.
    NEXT_PUBLIC_CHAT_ENDPOINT_URL: z.string().url().optional(),

    // Which transport adapter to use.
    // "mock"              — local dev, no backend required
    // "static-proxy"      — calls NEXT_PUBLIC_CHAT_ENDPOINT_URL, parses SSE
    // "responses"         — Databricks Responses API stream format
    // "chat-completions"  — legacy Chat Completions stream format
    NEXT_PUBLIC_TRANSPORT_MODE: z
      .enum(["mock", "static-proxy", "responses", "chat-completions"])
      .default("mock"),
  },
  runtimeEnv: {
    NEXT_PUBLIC_CHAT_ENDPOINT_URL: process.env.NEXT_PUBLIC_CHAT_ENDPOINT_URL,
    NEXT_PUBLIC_TRANSPORT_MODE: process.env.NEXT_PUBLIC_TRANSPORT_MODE,
  },
});
