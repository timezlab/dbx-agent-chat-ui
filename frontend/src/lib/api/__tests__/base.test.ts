import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { z, type ZodType } from "zod";

import { ApiService } from "@/lib/api/base";

const Schema = z.object({ ok: z.boolean() });

/** Concrete subclass exposing the protected request helpers for direct testing. */
class TestApi extends ApiService {
  run<T>(schema: ZodType<T>, config: AxiosRequestConfig) {
    return this.request(schema, config, "Test.run");
  }
  runOrNull<T>(schema: ZodType<T>, config: AxiosRequestConfig) {
    return this.requestOrNull(schema, config, "Test.run");
  }
  runVoid(config: AxiosRequestConfig) {
    return this.requestVoid(config, "Test.run");
  }
}

function clientReturning(data: unknown): AxiosInstance {
  return { request: vi.fn(async () => ({ data })) } as unknown as AxiosInstance;
}
function clientRejecting(error: unknown): AxiosInstance {
  return {
    request: vi.fn(async () => {
      throw error;
    }),
  } as unknown as AxiosInstance;
}
function axiosError(status: number, data?: unknown): AxiosError {
  return new AxiosError(
    "req failed",
    "ERR_BAD_RESPONSE",
    undefined,
    undefined,
    { status, data, statusText: "", headers: {}, config: {} as never },
  );
}

describe("ApiService base", () => {
  it("request parses a valid body with the schema", async () => {
    const api = new TestApi("https://x", clientReturning({ ok: true }));
    await expect(api.run(Schema, { method: "GET" })).resolves.toEqual({
      ok: true,
    });
  });

  it("request throws a readable Error on a malformed body (ZodError)", async () => {
    const api = new TestApi("https://x", clientReturning({ ok: "nope" }));
    await expect(api.run(Schema, { method: "GET" })).rejects.toThrow(
      /malformed response/,
    );
  });

  it("request surfaces the server `detail` message on an AxiosError", async () => {
    const api = new TestApi(
      "https://x",
      clientRejecting(axiosError(500, { detail: "boom on server" })),
    );
    await expect(api.run(Schema, { method: "GET" })).rejects.toThrow(
      "boom on server",
    );
  });

  it("requestOrNull resolves to null on a 404", async () => {
    const api = new TestApi("https://x", clientRejecting(axiosError(404)));
    await expect(api.runOrNull(Schema, { method: "GET" })).resolves.toBeNull();
  });

  it("requestOrNull still throws on a non-404 error", async () => {
    const api = new TestApi("https://x", clientRejecting(axiosError(500)));
    await expect(api.runOrNull(Schema, { method: "GET" })).rejects.toThrow();
  });

  it("requestVoid resolves on success and throws on error", async () => {
    const ok = new TestApi("https://x", clientReturning(undefined));
    await expect(ok.runVoid({ method: "POST" })).resolves.toBeUndefined();
    const bad = new TestApi("https://x", clientRejecting(axiosError(400)));
    await expect(bad.runVoid({ method: "POST" })).rejects.toThrow();
  });
});
