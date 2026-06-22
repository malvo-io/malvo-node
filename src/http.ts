/**
 * Internal request engine: owns the apiKey lifecycle and the retry policy so
 * the client surface stays a thin one-method-per-endpoint map.
 *
 * - Lazy `POST /auth` on the first call; in-memory apiKey cache per instance.
 * - Proactive refresh once the apiKey is older than `apiKeyTtlMs` (< 2h TTL).
 * - A shared in-flight auth promise so concurrent calls don't stampede `/auth`.
 * - Retry once on `401` (force re-auth + replay), back off on `429`.
 */
import { MalvoApiError } from "./errors";
import type { MalvoClientOptions } from "./types";

const DEFAULT_BASE_URL = "https://api.malvo.io";
const DEFAULT_API_KEY_TTL_MS = 110 * 60 * 1000; // ~1h50 of the 2h apiKey TTL
const DEFAULT_MAX_RETRIES = 4;

export type QueryValue = string | number | boolean | string[] | number[] | undefined | null;
export type Query = Record<string, QueryValue>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** Attach the apiKey (and auto-authenticate). Default `true`. */
  auth?: boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Serializes a query object; arrays become comma-separated, empties are dropped. */
function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export class HttpClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly apiKeyTtlMs: number;
  private readonly maxRetries: number;

  private apiKey: string | null = null;
  private apiKeyFetchedAt = 0;
  private authPromise: Promise<string> | null = null;

  constructor(options: MalvoClientOptions) {
    if (!options?.clientId || !options?.clientSecret) {
      throw new Error("MalvoClient requires both clientId and clientSecret.");
    }
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== "function") {
      throw new Error(
        "No global fetch found. Use Node >=18, or pass a `fetch` implementation in MalvoClientOptions.",
      );
    }
    this.fetchFn = f;
    this.apiKeyTtlMs = options.apiKeyTtlMs ?? DEFAULT_API_KEY_TTL_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /** Ensures a fresh apiKey is cached, authenticating if missing or stale. */
  async ensureAuthenticated(): Promise<void> {
    await this.getApiKey();
  }

  private async getApiKey(forceRefresh = false): Promise<string> {
    const fresh =
      this.apiKey !== null && Date.now() - this.apiKeyFetchedAt < this.apiKeyTtlMs;
    if (!forceRefresh && fresh) return this.apiKey as string;

    // Coalesce concurrent auth attempts into one in-flight request.
    if (!this.authPromise) {
      this.authPromise = this.authenticate().finally(() => {
        this.authPromise = null;
      });
    }
    return this.authPromise;
  }

  private async authenticate(): Promise<string> {
    const res = await this.rawFetch("POST", "/auth", {
      body: { clientId: this.clientId, clientSecret: this.clientSecret },
    });
    const data = await this.parse(res);
    if (!res.ok) throw this.toError(res, data);
    const apiKey = (data as { apiKey?: string })?.apiKey;
    if (!apiKey) {
      throw new MalvoApiError({
        code: res.status,
        statusCode: res.status,
        message: "Authentication succeeded but no apiKey was returned.",
      });
    }
    this.apiKey = apiKey;
    this.apiKeyFetchedAt = Date.now();
    return apiKey;
  }

  /** Performs an authenticated request with the full retry policy. */
  async request<T>(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const useAuth = opts.auth !== false;
    let reauthed = false;

    for (let attempt = 0; ; attempt++) {
      const headers: Record<string, string> = {};
      if (useAuth) headers["X-API-KEY"] = await this.getApiKey();

      const res = await this.rawFetch(method, path, { ...opts, headers });

      if (res.status === 429 && attempt < this.maxRetries) {
        await sleep(this.retryDelayMs(res, attempt));
        continue;
      }

      // apiKey expired mid-flight: force one re-auth and replay.
      if (res.status === 401 && useAuth && !reauthed) {
        reauthed = true;
        await this.getApiKey(true);
        continue;
      }

      if (res.status === 204) return undefined as T;

      const data = await this.parse(res);
      if (!res.ok) throw this.toError(res, data);
      return data as T;
    }
  }

  private async rawFetch(
    method: string,
    path: string,
    opts: { query?: Query; body?: unknown; headers?: Record<string, string> },
  ): Promise<Response> {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const url = this.baseUrl + path + buildQuery(opts.query);
    try {
      return await this.fetchFn(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (cause) {
      throw new MalvoApiError({
        code: 0,
        statusCode: 0,
        message: `Could not reach the Malvo API at ${this.baseUrl}.`,
        data: cause,
      });
    }
  }

  private async parse(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  private retryDelayMs(res: Response, attempt: number): number {
    const retryAfter = Number(res.headers.get("Retry-After"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
    return Math.min(2 ** attempt, 30) * 1000;
  }

  private toError(res: Response, data: unknown): MalvoApiError {
    const env = (data ?? {}) as {
      code?: number;
      message?: string;
      codeDescription?: string;
      data?: unknown;
      requestId?: string;
    };
    return new MalvoApiError({
      code: typeof env.code === "number" ? env.code : res.status,
      statusCode: res.status,
      message: env.message ?? `Unexpected error (HTTP ${res.status}).`,
      codeDescription: env.codeDescription,
      data: env.data,
      requestId: env.requestId ?? res.headers.get("X-Request-ID") ?? undefined,
    });
  }
}
