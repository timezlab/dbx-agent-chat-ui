import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
} from "axios";
import { ZodError, type ZodType } from "zod";

/**
 * Shared HTTP layer for every REST capability (history, agents, feedback, identity).
 *
 * One axios instance per service (built from that capability's own endpoint URL — each
 * URL is independent in this app, D8), with a small `request`/`requestOrNull`/
 * `requestVoid` surface that parses the whole response body through a zod schema. No
 * `as { … }` casts anywhere downstream: a malformed payload fails `schema.parse` and is
 * normalized into a readable Error the caller can swallow into an empty state.
 *
 * Deliberately WITHOUT the next-auth session-refresh / `signOut` logic of the reference
 * implementation — this is a UI-only, static-export app (Principle I/II). Auth, if any,
 * is the deployment wrapper's concern via same-origin cookies (`withCredentials`); no
 * credential is ever bundled.
 */

/** Turn a Zod/Axios failure into a plain, human-readable Error (no framework leakage). */
function normalizeError(error: unknown, label: string): Error {
  if (error instanceof ZodError) {
    return new Error(`${label}: malformed response`);
  }
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as
      | { detail?: unknown; error?: unknown }
      | undefined;
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : typeof data?.error === "string"
          ? data.error
          : undefined;
    return new Error(
      detail ?? (status ? `${label} failed (${status})` : `${label} failed`),
    );
  }
  return error instanceof Error ? error : new Error(`${label} failed`);
}

export abstract class ApiService {
  protected readonly client: AxiosInstance;

  /**
   * @param baseURL the capability's endpoint (undefined ⇒ unconfigured; subclass methods
   *   short-circuit to an empty result without issuing a request).
   * @param client  an injected axios instance for tests; defaults to a fresh one.
   */
  constructor(
    protected readonly baseURL: string | undefined,
    client?: AxiosInstance,
  ) {
    this.client =
      client ??
      axios.create({
        baseURL,
        withCredentials: true,
        headers: { Accept: "application/json" },
      });
  }

  /** True when an endpoint URL is configured — callers return empty otherwise. */
  protected get configured(): boolean {
    return Boolean(this.baseURL);
  }

  /** Issue a request and parse the body with `schema`; throws a readable Error on failure. */
  protected async request<T>(
    schema: ZodType<T>,
    config: AxiosRequestConfig,
    label: string,
  ): Promise<T> {
    try {
      const { data } = await this.client.request(config);
      return schema.parse(data);
    } catch (error) {
      throw normalizeError(error, label);
    }
  }

  /** Like `request`, but a `404` resolves to `null` (a missing resource, not an error). */
  protected async requestOrNull<T>(
    schema: ZodType<T>,
    config: AxiosRequestConfig,
    label: string,
  ): Promise<T | null> {
    try {
      const { data } = await this.client.request(config);
      return schema.parse(data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw normalizeError(error, label);
    }
  }

  /** Issue a request with no response body of interest (e.g. a POST that returns 2xx). */
  protected async requestVoid(
    config: AxiosRequestConfig,
    label: string,
  ): Promise<void> {
    try {
      await this.client.request(config);
    } catch (error) {
      throw normalizeError(error, label);
    }
  }
}
