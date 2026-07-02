import { describe, expect, it } from "vitest";

import {
  DEFAULT_UPLOAD_ACCEPT,
  isChatEndpointMissing,
  parseSamplePrompts,
  parseUploadAccept,
  parseUploadEnabled,
  parseUploadMaxSizeMb,
} from "@/lib/config";
import { MAX_ATTACHMENT_SIZE_BYTES } from "@/lib/chat/attachments";

describe("parseSamplePrompts", () => {
  it("parses a JSON array of strings, trimming and dropping blanks", () => {
    expect(
      parseSamplePrompts('["Summarize this doc", "  Write a SQL query  ", ""]'),
    ).toEqual(["Summarize this doc", "Write a SQL query"]);
  });

  it("returns [] when unset", () => {
    expect(parseSamplePrompts(undefined)).toEqual([]);
  });

  it("returns [] on malformed JSON", () => {
    expect(parseSamplePrompts("not json")).toEqual([]);
  });

  it("returns [] when the JSON value is not an array", () => {
    expect(parseSamplePrompts('{"a": 1}')).toEqual([]);
  });

  it("drops non-string entries but keeps valid ones", () => {
    expect(parseSamplePrompts('["ok", 1, null, "also ok"]')).toEqual([
      "ok",
      "also ok",
    ]);
  });
});

describe("parseUploadEnabled", () => {
  it.each(["1", "true", "yes", "TRUE", " Yes "])(
    "treats %j as enabled",
    (raw) => {
      expect(parseUploadEnabled(raw)).toBe(true);
    },
  );

  it.each([undefined, "", "0", "false", "no", "on"])(
    "treats %j as disabled",
    (raw) => {
      expect(parseUploadEnabled(raw)).toBe(false);
    },
  );
});

describe("parseUploadAccept (T071)", () => {
  it("defaults to images only when unset/blank", () => {
    expect(parseUploadAccept(undefined)).toBe(DEFAULT_UPLOAD_ACCEPT);
    expect(parseUploadAccept("   ")).toBe(DEFAULT_UPLOAD_ACCEPT);
  });

  it("returns the trimmed configured value", () => {
    expect(parseUploadAccept(" image/*,application/pdf ")).toBe(
      "image/*,application/pdf",
    );
  });
});

describe("parseUploadMaxSizeMb (T071)", () => {
  it("defaults to MAX_ATTACHMENT_SIZE_BYTES when unset/invalid", () => {
    expect(parseUploadMaxSizeMb(undefined)).toBe(MAX_ATTACHMENT_SIZE_BYTES);
    expect(parseUploadMaxSizeMb("not a number")).toBe(MAX_ATTACHMENT_SIZE_BYTES);
    expect(parseUploadMaxSizeMb("0")).toBe(MAX_ATTACHMENT_SIZE_BYTES);
    expect(parseUploadMaxSizeMb("-5")).toBe(MAX_ATTACHMENT_SIZE_BYTES);
  });

  it("converts a configured MB value to bytes", () => {
    expect(parseUploadMaxSizeMb("5")).toBe(5 * 1024 * 1024);
  });
});

describe("isChatEndpointMissing", () => {
  it("is true when chatEndpointUrl is unset", () => {
    expect(isChatEndpointMissing({})).toBe(true);
  });

  it("is false when chatEndpointUrl is set", () => {
    expect(
      isChatEndpointMissing({ chatEndpointUrl: "https://agent.example/invoke" }),
    ).toBe(false);
  });
});
