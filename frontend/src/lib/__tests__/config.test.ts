import { describe, expect, it } from "vitest";

import {
  isChatEndpointMissing,
  parseSamplePrompts,
  parseUploadEnabled,
} from "@/lib/config";

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
