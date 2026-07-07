import { CapabilityConfigSchema, type CapabilityConfig } from "@/entities";
import { env } from "@/env";
import { MAX_ATTACHMENT_SIZE_BYTES } from "@/lib/chat/attachments";

/**
 * Đọc public env (`env.ts`) → `CapabilityConfig` đã validate (entities/config.ts).
 * Mỗi URL độc lập & optional (D8). KHÔNG chứa secret — chỉ `NEXT_PUBLIC_*` (Principle II).
 */
export function resolveConfig(): CapabilityConfig {
  return CapabilityConfigSchema.parse({
    chatEndpointUrl: resolveDeploymentUrl(env.NEXT_PUBLIC_CHAT_ENDPOINT_URL),
    historyUrl: resolveDeploymentUrl(env.NEXT_PUBLIC_HISTORY_API_URL),
    feedbackUrl: resolveDeploymentUrl(env.NEXT_PUBLIC_FEEDBACK_API_URL),
    agentsUrl: resolveDeploymentUrl(env.NEXT_PUBLIC_AGENTS_API_URL),
    meUrl: resolveDeploymentUrl(env.NEXT_PUBLIC_ME_API_URL),
    samplePrompts: parseSamplePrompts(env.NEXT_PUBLIC_SAMPLE_PROMPTS),
    uploadEnabled: parseUploadEnabled(env.NEXT_PUBLIC_ENABLE_UPLOAD),
    uploadAccept: parseUploadAccept(env.NEXT_PUBLIC_UPLOAD_ACCEPT),
    uploadMaxSizeBytes: parseUploadMaxSizeMb(env.NEXT_PUBLIC_UPLOAD_MAX_SIZE_MB),
    devToolsEnabled: parseDevToolsEnabled(env.NEXT_PUBLIC_DEV_TOOLS),
    usageEnabled: parseShowUsage(env.NEXT_PUBLIC_SHOW_USAGE),
    contextWindow: parseContextWindow(env.NEXT_PUBLIC_CONTEXT_WINDOW),
    docsUrl: resolveDeploymentUrl(env.NEXT_PUBLIC_DOCS_URL),
    welcomeUrl: resolveDeploymentUrl(env.NEXT_PUBLIC_WELCOME_URL),
  });
}

/**
 * Resolve a configured endpoint against the app's deployment base path, so ONE static
 * build works under any mount point without a rebuild (constitution: "one static build
 * serves notebook/proxy, Databricks Apps, and manual copy").
 *
 * A root-relative value like `/api/chat` is treated as relative to where the app is
 * actually served — at `domain.com/path/proxy/` it becomes
 * `domain.com/path/proxy/api/chat`, NOT the domain root. Resolving against the page's own
 * base (`document.baseURI`) means an API call always goes back through the same
 * origin+prefix the app was loaded from — correct for root hosting, a reverse-proxy
 * subpath, and a driver-proxy alike. Absolute (`https://…`) and protocol-relative
 * (`//host/…`) URLs pass through unchanged, so a truly cross-origin endpoint is still
 * possible. Unset/blank ⇒ undefined.
 *
 * On the server (static prerender, no `document`) the raw value is returned; `resolveConfig`
 * runs again in the browser at runtime where the real base is known.
 */
export function resolveDeploymentUrl(
  raw: string | undefined,
  baseHref: string | undefined = typeof document !== "undefined"
    ? document.baseURI
    : undefined,
): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (/^(https?:)?\/\//i.test(value)) return value; // absolute or protocol-relative
  if (!baseHref) return value; // SSR/prerender — re-resolved client-side at runtime
  const baseDir = new URL(".", baseHref).href; // deployment root (single-page export)
  return new URL(value.replace(/^\/+/, ""), baseDir).href;
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
 * Parse `NEXT_PUBLIC_DEV_TOOLS` into a boolean. Truthy = "1"/"true"/"yes"
 * (case-insensitive, trimmed); everything else (including unset) ⇒ false, so the Dev
 * tools / Replay entry is opt-in and hidden by default (FR-026, Principle II). Mirrors
 * `parseUploadEnabled` — a non-secret build/deploy-time selector.
 */
export function parseDevToolsEnabled(raw: string | undefined): boolean {
  if (!raw) return false;
  return ["1", "true", "yes"].includes(raw.trim().toLowerCase());
}

/**
 * Parse `NEXT_PUBLIC_SHOW_USAGE` into a boolean — inverted default vs the opt-in flags
 * above. The usage/metrics footer is a UX feature meant to be visible, so it is ON unless
 * EXPLICITLY disabled with "0"/"false"/"no"/"off" (case-insensitive, trimmed). Unset/blank
 * or anything else ⇒ true.
 */
export function parseShowUsage(raw: string | undefined): boolean {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed) return true;
  return !["0", "false", "no", "off"].includes(trimmed);
}

/**
 * Default context-window size (tokens) when `NEXT_PUBLIC_CONTEXT_WINDOW` is unset and the
 * backend reports no per-turn `context_window`. 200k mirrors the current Claude family
 * default and is a safe visible baseline for the meter (004).
 */
export const DEFAULT_CONTEXT_WINDOW = 200000;

/**
 * Parse `NEXT_PUBLIC_CONTEXT_WINDOW` (a plain token count) into a positive integer. Unset,
 * non-numeric, zero, or negative all degrade to `DEFAULT_CONTEXT_WINDOW` rather than
 * throwing or allowing a zero/negative limit that would break the meter's percentage.
 * Backend-reported `metrics.contextWindow` always takes precedence over this fallback.
 */
export function parseContextWindow(raw: string | undefined): number {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_CONTEXT_WINDOW;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_CONTEXT_WINDOW;
  return Math.round(n);
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
