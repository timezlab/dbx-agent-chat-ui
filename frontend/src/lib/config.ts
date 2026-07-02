import { CapabilityConfigSchema, type CapabilityConfig } from "@/entities";
import { env } from "@/env";
import { MAX_ATTACHMENT_SIZE_BYTES } from "@/lib/chat/attachments";

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
    uploadAccept: parseUploadAccept(env.NEXT_PUBLIC_UPLOAD_ACCEPT),
    uploadMaxSizeBytes: parseUploadMaxSizeMb(env.NEXT_PUBLIC_UPLOAD_MAX_SIZE_MB),
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

/** Default accept list when `NEXT_PUBLIC_UPLOAD_ACCEPT` is unset — images only. */
export const DEFAULT_UPLOAD_ACCEPT = "image/*";

/**
 * Parse `NEXT_PUBLIC_UPLOAD_ACCEPT` (comma-separated mime patterns/extensions) into a
 * trimmed string. Unset/blank ⇒ `DEFAULT_UPLOAD_ACCEPT` (images only); a deployment
 * that wants every file type must opt in explicitly with a wildcard MIME accept value.
 * No further validation here — matching against a picked file happens in
 * `lib/chat/attachments.ts`.
 */
export function parseUploadAccept(raw: string | undefined): string {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : DEFAULT_UPLOAD_ACCEPT;
}

/**
 * Parse `NEXT_PUBLIC_UPLOAD_MAX_SIZE_MB` (a plain number of megabytes) into a byte
 * count. Unset, non-numeric, zero, or negative all degrade to `MAX_ATTACHMENT_SIZE_BYTES`
 * (the built-in default) rather than throwing or allowing an unbounded/zero cap.
 */
export function parseUploadMaxSizeMb(raw: string | undefined): number {
  const trimmed = raw?.trim();
  if (!trimmed) return MAX_ATTACHMENT_SIZE_BYTES;
  const mb = Number(trimmed);
  if (!Number.isFinite(mb) || mb <= 0) return MAX_ATTACHMENT_SIZE_BYTES;
  return Math.round(mb * 1024 * 1024);
}

/**
 * App cần 1 chat endpoint để stream. Thiếu ⇒ UI hiện thông báo inline thay vì fail im
 * lặng (spec Edge Cases, T055). Local dev: trỏ endpoint vào mock-api script.
 */
export function isChatEndpointMissing(config: CapabilityConfig): boolean {
  return !config.chatEndpointUrl;
}
