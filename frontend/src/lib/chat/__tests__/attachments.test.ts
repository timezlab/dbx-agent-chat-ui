import { describe, expect, it } from "vitest";

import {
  MAX_ATTACHMENT_SIZE_BYTES,
  matchesAccept,
  validateAttachment,
} from "@/lib/chat/attachments";

describe("matchesAccept (T071)", () => {
  it("accepts anything when the accept list is blank", () => {
    expect(matchesAccept({ name: "a.csv", mimeType: "text/csv" }, "")).toBe(true);
  });

  it("matches an exact mime type", () => {
    expect(
      matchesAccept({ name: "a.pdf", mimeType: "application/pdf" }, "application/pdf"),
    ).toBe(true);
    expect(
      matchesAccept({ name: "a.pdf", mimeType: "application/pdf" }, "image/png"),
    ).toBe(false);
  });

  it("matches a mime wildcard prefix (e.g. image/*)", () => {
    expect(matchesAccept({ name: "a.png", mimeType: "image/png" }, "image/*")).toBe(
      true,
    );
    expect(matchesAccept({ name: "a.pdf", mimeType: "application/pdf" }, "image/*")).toBe(
      false,
    );
  });

  it("matches a file-extension pattern case-insensitively", () => {
    expect(matchesAccept({ name: "report.CSV", mimeType: "" }, ".csv")).toBe(true);
    expect(matchesAccept({ name: "report.txt", mimeType: "" }, ".csv")).toBe(false);
  });

  it("matches when any one of several comma-separated patterns matches", () => {
    const accept = "image/*,application/pdf,.csv";
    expect(matchesAccept({ name: "a.png", mimeType: "image/png" }, accept)).toBe(true);
    expect(
      matchesAccept({ name: "a.pdf", mimeType: "application/pdf" }, accept),
    ).toBe(true);
    expect(matchesAccept({ name: "a.csv", mimeType: "text/csv" }, accept)).toBe(true);
    expect(matchesAccept({ name: "a.docx", mimeType: "application/msword" }, accept)).toBe(
      false,
    );
  });
});

describe("validateAttachment (T071)", () => {
  it("passes a file within the size cap and accept list", () => {
    expect(
      validateAttachment({ name: "a.png", mimeType: "image/png", size: 1024 }, "image/*"),
    ).toBeNull();
  });

  it("rejects a file over the size cap with an explanatory message", () => {
    const error = validateAttachment(
      { name: "a.png", mimeType: "image/png", size: MAX_ATTACHMENT_SIZE_BYTES + 1 },
      "image/*",
    );
    expect(error).not.toBeNull();
    expect(error).toMatch(/too large|size/i);
  });

  it("rejects a file type not in the accept list with an explanatory message", () => {
    const error = validateAttachment(
      { name: "a.pdf", mimeType: "application/pdf", size: 1024 },
      "image/*",
    );
    expect(error).not.toBeNull();
    expect(error).toMatch(/type|not (allowed|supported|accepted)/i);
  });

  it("honors a caller-supplied size cap instead of the default", () => {
    expect(
      validateAttachment({ name: "a.png", mimeType: "image/png", size: 2000 }, "image/*", 1000),
    ).not.toBeNull();
    expect(
      validateAttachment({ name: "a.png", mimeType: "image/png", size: 500 }, "image/*", 1000),
    ).toBeNull();
  });
});
