/**
 * Pure attachment validation (T071). No DOM/File API here — the composer reads the
 * `File` (name/type/size) and passes plain values in, so this stays unit-testable
 * without jsdom's File/FileReader shims.
 */

/** Default cap when `NEXT_PUBLIC_UPLOAD_MAX_SIZE_MB` is unset. Chosen to stay
 *  comfortably under Databricks Model Serving's documented 16 MB request-payload limit
 *  (see docs/references/databricks-research.md) even with base64's ~33% overhead and
 *  some message history alongside it. Deployments pointed at a custom backend with a
 *  higher/lower real ceiling can override it via env — see `lib/config.ts`. */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export interface PickedFile {
  name: string;
  mimeType: string;
  size?: number;
}

/**
 * A single accept pattern matches one of three ways: an exact mime type
 * ("application/pdf"), a mime wildcard prefix ("image/*"), or a file-extension
 * suffix (".csv", matched against the name, case-insensitive).
 */
function matchesOnePattern(file: PickedFile, pattern: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  if (p.startsWith(".")) {
    return file.name.toLowerCase().endsWith(p.toLowerCase());
  }
  if (p.endsWith("/*")) {
    return file.mimeType.toLowerCase().startsWith(p.slice(0, -1).toLowerCase());
  }
  return file.mimeType.toLowerCase() === p.toLowerCase();
}

/** Blank/unset `accept` means no restriction — every file type matches. */
export function matchesAccept(file: PickedFile, accept: string | undefined): boolean {
  const trimmed = accept?.trim();
  if (!trimmed) return true;
  return trimmed.split(",").some((pattern) => matchesOnePattern(file, pattern));
}

/**
 * Returns a user-facing rejection reason, or `null` when the file is acceptable.
 * `maxSizeBytes` defaults to `MAX_ATTACHMENT_SIZE_BYTES` but is normally the
 * env-resolved `CapabilityConfig.uploadMaxSizeBytes` (see `lib/config.ts`).
 */
export function validateAttachment(
  file: PickedFile,
  accept: string | undefined,
  maxSizeBytes: number = MAX_ATTACHMENT_SIZE_BYTES,
): string | null {
  if (typeof file.size === "number" && file.size > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
    return `"${file.name}" is too large (max ${maxMb} MB per file).`;
  }
  if (!matchesAccept(file, accept)) {
    return `"${file.name}" is not an accepted file type.`;
  }
  return null;
}
