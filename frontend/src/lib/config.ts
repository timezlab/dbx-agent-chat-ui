import { CapabilityConfigSchema, type CapabilityConfig } from "@/entities";
import { env } from "@/env";

/**
 * Đọc public env (`env.ts`) → `CapabilityConfig` đã validate (entities/config.ts).
 * Mỗi URL độc lập & optional (D8). KHÔNG chứa secret — chỉ `NEXT_PUBLIC_*` (Principle II).
 */
export function resolveConfig(): CapabilityConfig {
  return CapabilityConfigSchema.parse({
    chatEndpointUrl: env.NEXT_PUBLIC_CHAT_ENDPOINT_URL,
    historyUrl: env.NEXT_PUBLIC_HISTORY_API_URL,
    feedbackUrl: env.NEXT_PUBLIC_FEEDBACK_API_URL,
    agentsUrl: env.NEXT_PUBLIC_AGENTS_API_URL,
    samplePrompts: parseSamplePrompts(env.NEXT_PUBLIC_SAMPLE_PROMPTS),
    uploadEnabled: parseUploadEnabled(env.NEXT_PUBLIC_ENABLE_UPLOAD),
  });
}

/**
 * Parse `NEXT_PUBLIC_SAMPLE_PROMPTS` (a JSON array of strings) into a clean list.
 * Anything malformed — not JSON, not an array, non-string items — degrades to `[]`
 * (no samples) rather than throwing, so a typo in deployment config can't crash the
 * empty-state. Blank strings are dropped and each entry is trimmed.
 */
export function parseSamplePrompts(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  } catch {
    return [];
  }
}

/**
 * Parse `NEXT_PUBLIC_ENABLE_UPLOAD` into a boolean. Truthy = "1"/"true"/"yes"
 * (case-insensitive, trimmed); everything else (including unset) ⇒ false, so upload
 * is opt-in and stays off by default (D-014 defers real upload).
 */
export function parseUploadEnabled(raw: string | undefined): boolean {
  if (!raw) return false;
  return ["1", "true", "yes"].includes(raw.trim().toLowerCase());
}

/**
 * App cần 1 chat endpoint để stream. Thiếu ⇒ UI hiện thông báo inline thay vì fail im
 * lặng (spec Edge Cases, T055). Local dev: trỏ endpoint vào mock-api script.
 */
export function isChatEndpointMissing(config: CapabilityConfig): boolean {
  return !config.chatEndpointUrl;
}
