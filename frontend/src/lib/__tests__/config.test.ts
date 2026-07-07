import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_UPLOAD_ACCEPT,
  isChatEndpointMissing,
  parseContextWindow,
  parseDevToolsEnabled,
  parseSamplePrompts,
  parseUploadAccept,
  parseUploadEnabled,
  parseUploadMaxSizeMb,
  resolveDeploymentUrl,
} from "@/lib/config";
import { MAX_ATTACHMENT_SIZE_BYTES } from "@/lib/chat/attachments";

describe("resolveDeploymentUrl", () => {
  const proxyBase = "https://domain.com/path/proxy/";
  const rootBase = "https://domain.com/";

  it("resolves a root-relative path against a subpath deployment base", () => {
    // The user just enters "/api/chat"; under a proxy subpath it must hit the API
    // co-located with the app, not the domain root.
    expect(resolveDeploymentUrl("/api/chat", proxyBase)).toBe(
      "https://domain.com/path/proxy/api/chat",
    );
    expect(resolveDeploymentUrl("/api/chat", proxyBase)).toBe(
      "https://domain.com/path/proxy/api/chat",
    );
  });

  it("is a no-op-equivalent at the domain root", () => {
    expect(resolveDeploymentUrl("/api/chat", rootBase)).toBe(
      "https://domain.com/api/chat",
    );
  });

  it("resolves against the base directory even from a deep entry document", () => {
    expect(
      resolveDeploymentUrl("/api/chat", "https://domain.com/path/proxy/index.html"),
    ).toBe("https://domain.com/path/proxy/api/chat");
  });

  it("treats a no-leading-slash path the same as root-relative", () => {
    expect(resolveDeploymentUrl("api/chat", proxyBase)).toBe(
      "https://domain.com/path/proxy/api/chat",
    );
  });

  it("passes absolute and protocol-relative URLs through unchanged", () => {
    expect(resolveDeploymentUrl("https://agent.example/invoke", proxyBase)).toBe(
      "https://agent.example/invoke",
    );
    expect(resolveDeploymentUrl("//cdn.example/x", proxyBase)).toBe(
      "//cdn.example/x",
    );
  });

  it("returns undefined for unset/blank, and the raw value when no base is known", () => {
    expect(resolveDeploymentUrl(undefined, proxyBase)).toBeUndefined();
    expect(resolveDeploymentUrl("   ", proxyBase)).toBeUndefined();
    // No base (server prerender) → raw value, resolved again client-side later.
    expect(resolveDeploymentUrl("/api/chat", "")).toBe("/api/chat");
  });
});

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

describe("parseDevToolsEnabled (FR-026)", () => {
  it.each(["1", "true", "yes", "TRUE", " Yes "])(
    "treats %j as enabled",
    (raw) => {
      expect(parseDevToolsEnabled(raw)).toBe(true);
    },
  );

  it.each([undefined, "", "0", "false", "no", "on"])(
    "treats %j as disabled (default off)",
    (raw) => {
      expect(parseDevToolsEnabled(raw)).toBe(false);
    },
  );
});

describe("parseContextWindow (004)", () => {
  it("defaults to DEFAULT_CONTEXT_WINDOW when unset/blank", () => {
    expect(parseContextWindow(undefined)).toBe(DEFAULT_CONTEXT_WINDOW);
    expect(parseContextWindow("   ")).toBe(DEFAULT_CONTEXT_WINDOW);
  });

  it("parses a configured token count", () => {
    expect(parseContextWindow("128000")).toBe(128000);
  });

  it("falls back to the default on non-numeric / zero / negative", () => {
    expect(parseContextWindow("not a number")).toBe(DEFAULT_CONTEXT_WINDOW);
    expect(parseContextWindow("0")).toBe(DEFAULT_CONTEXT_WINDOW);
    expect(parseContextWindow("-5")).toBe(DEFAULT_CONTEXT_WINDOW);
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
