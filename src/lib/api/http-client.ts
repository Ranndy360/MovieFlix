import { env } from '@/lib/env';
import { ApiError, type ApiErrorBody } from './api-error';

/** Values accepted in a query object. `undefined` and `null` are dropped. */
export type QueryValue = string | number | boolean | null | undefined | Array<string | number>;
export type QueryParams = Record<string, QueryValue>;

export interface RequestOptions extends Omit<RequestInit, 'method' | 'body' | 'headers'> {
  /** Serialized into a query string; empty values are omitted. */
  query?: QueryParams;
  headers?: Record<string, string>;
  /**
   * Set false on the auth endpoints themselves, so a failed `/auth/refresh`
   * cannot trigger another refresh.
   */
  skipAuthRefresh?: boolean;
  /** Overrides the client default. `0` disables the timeout. */
  timeoutMs?: number;
  /** Extra attempts for retryable failures (network / timeout / 5xx). */
  retries?: number;
  /** Caller-owned abort signal; composed with the timeout signal. */
  signal?: AbortSignal;
  /** Next.js fetch cache directives — only meaningful on the server. */
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
}

export interface HttpClientConfig {
  baseUrl: string;
  timeoutMs?: number;
  retries?: number;
  defaultHeaders?: Record<string, string>;
  /**
   * Send cookies with every request. Required for our auth, which uses
   * `httpOnly` cookies rather than a token the client can read.
   */
  withCredentials?: boolean;
  /**
   * Called before every request. Return a bearer token to attach, or
   * `undefined` for anonymous calls. Unused by the browser client (cookies
   * carry the session); kept for server-to-server callers.
   */
  getAuthToken?: () => string | undefined | Promise<string | undefined>;
  /**
   * Invoked once when a request 401s, to try to renew the session. Resolve
   * `true` if the caller should be retried. See `attemptRefresh` below for why
   * this is single-flighted.
   */
  onUnauthorized?: () => Promise<boolean>;
  /** Escape hatch for logging/telemetry. Must not throw. */
  onError?: (error: ApiError) => void;
}

const RETRY_BASE_DELAY_MS = 300;
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Turns `{ page: 2, genre: 'HORROR', search: '' }` into `?page=2&genre=HORROR`.
 * Empty strings, `null` and `undefined` are dropped so a cleared filter does
 * not become `search=` and change the cache key for no reason.
 */
export function buildQueryString(query: QueryParams | undefined): string {
  if (!query) return '';

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, String(entry)));
    } else {
      params.append(key, String(value));
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

/**
 * The single point through which the frontend talks to MovieFlix-api.
 *
 * Nothing else in the app should call `fetch` against the backend: this class
 * owns base URL resolution, auth headers, timeouts, retries, JSON
 * (de)serialization and the translation of every failure into `ApiError`.
 * It runs unchanged in Server Components, Route Handlers and the browser.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly withCredentials: boolean;
  private readonly getAuthToken: HttpClientConfig['getAuthToken'];
  private readonly onError: HttpClientConfig['onError'];

  private onUnauthorized: HttpClientConfig['onUnauthorized'];

  /**
   * The in-flight refresh, if any. When several requests 401 at once — the
   * normal case, since a page fires many calls in parallel — they all await
   * this one promise instead of each firing its own `/auth/refresh`. That
   * matters for correctness, not just efficiency: refresh tokens rotate, so
   * concurrent refreshes would invalidate each other and trip the backend's
   * reuse detection, logging the user out entirely.
   */
  private refreshInFlight: Promise<boolean> | null = null;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.retries = config.retries ?? 0;
    this.defaultHeaders = { Accept: 'application/json', ...config.defaultHeaders };
    this.withCredentials = config.withCredentials ?? false;
    this.getAuthToken = config.getAuthToken;
    this.onUnauthorized = config.onUnauthorized;
    this.onError = config.onError;
  }

  /**
   * Registered after construction to break the cycle: the refresh handler is
   * defined in terms of this same client.
   */
  setUnauthorizedHandler(handler: HttpClientConfig['onUnauthorized']): void {
    this.onUnauthorized = handler;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  /** `DELETE` usually answers 204; `T` is then `void`. */
  delete<T = void>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /** Absolute URL for `path`, including the serialized query string. */
  resolveUrl(path: string, query?: QueryParams): string {
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${suffix}${buildQueryString(query)}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const { query, headers, timeoutMs, retries, signal, skipAuthRefresh, ...init } = options;
    const url = this.resolveUrl(path, query);

    const maxAttempts =
      (retries ?? (IDEMPOTENT_METHODS.has(method) ? this.retries : 0)) + 1;

    let lastError: ApiError | undefined;
    let refreshed = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.attempt<T>({
          method,
          url,
          body,
          init,
          headers,
          timeoutMs: timeoutMs ?? this.timeoutMs,
          signal,
        });
      } catch (error) {
        const apiError = error as ApiError;
        lastError = apiError;

        // The access cookie expired: renew once, then replay this request.
        // Only once — a second 401 after a successful refresh means the caller
        // genuinely lacks permission, and retrying would loop.
        if (
          apiError.status === 401 &&
          !refreshed &&
          !skipAuthRefresh &&
          this.onUnauthorized &&
          apiError.kind === 'client'
        ) {
          refreshed = true;

          if (await this.attemptRefresh()) {
            attempt -= 1; // the replay does not consume a retry budget
            continue;
          }
        }

        // A caller-initiated abort is a decision, not a failure to retry.
        if (apiError.kind === 'aborted' || !apiError.isRetryable || attempt === maxAttempts) {
          break;
        }

        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }

    this.onError?.(lastError as ApiError);
    throw lastError;
  }

  /** Coalesces concurrent refreshes into a single request. */
  private attemptRefresh(): Promise<boolean> {
    this.refreshInFlight ??= (this.onUnauthorized?.() ?? Promise.resolve(false)).finally(() => {
      this.refreshInFlight = null;
    });

    return this.refreshInFlight;
  }

  private async attempt<T>(params: {
    method: string;
    url: string;
    body: unknown;
    init: Omit<RequestOptions, 'query' | 'headers' | 'timeoutMs' | 'retries' | 'signal'>;
    headers: Record<string, string> | undefined;
    timeoutMs: number;
    signal: AbortSignal | undefined;
  }): Promise<T> {
    const { method, url, body, init, headers, timeoutMs, signal } = params;

    const requestHeaders: Record<string, string> = { ...this.defaultHeaders, ...headers };

    const token = await this.getAuthToken?.();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isFormData && !requestHeaders['Content-Type']) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutId =
      timeoutMs > 0 ? setTimeout(() => controller.abort(new Error('timeout')), timeoutMs) : undefined;

    // Propagate the caller's abort into our controller.
    const onExternalAbort = (): void => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onExternalAbort, { once: true });

    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
        signal: controller.signal,
        ...(this.withCredentials ? { credentials: 'include' as const } : {}),
      });
    } catch (cause) {
      // fetch only rejects on abort or a genuine transport failure.
      if (signal?.aborted) {
        throw new ApiError({ message: 'Request aborted', status: 0, kind: 'aborted', url, cause });
      }
      if (controller.signal.aborted) {
        throw new ApiError({
          message: `Request to ${url} timed out after ${timeoutMs}ms`,
          status: 0,
          kind: 'timeout',
          url,
          cause,
        });
      }
      throw new ApiError({
        message: `Network error while requesting ${url}`,
        status: 0,
        kind: 'network',
        url,
        cause,
      });
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onExternalAbort);
    }

    if (!response.ok) {
      throw await this.toApiError(response, url);
    }

    return this.parseBody<T>(response, url);
  }

  private async parseBody<T>(response: Response, url: string): Promise<T> {
    // 204/205 and an explicitly empty body carry no JSON to parse.
    if (response.status === 204 || response.status === 205) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return (await response.text()) as T;
    }

    const text = await response.text();
    if (text.length === 0) {
      return undefined as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (cause) {
      throw new ApiError({
        message: `Expected JSON from ${url} but the body could not be parsed`,
        status: response.status,
        kind: 'parse',
        url,
        cause,
      });
    }
  }

  private async toApiError(response: Response, url: string): Promise<ApiError> {
    let body: ApiErrorBody | undefined;

    try {
      const text = await response.text();
      if (text) body = JSON.parse(text) as ApiErrorBody;
    } catch {
      // A non-JSON error body is not itself an error worth reporting.
      body = undefined;
    }

    const raw = body?.message;
    const message =
      (Array.isArray(raw) ? raw.join(', ') : raw) ||
      body?.error ||
      `${response.status} ${response.statusText}`;

    return new ApiError({
      message,
      status: response.status,
      kind: response.status >= 500 ? 'server' : 'client',
      url,
      body,
    });
  }
}

/**
 * The shared instance. Import this everywhere instead of constructing your own
 * so timeouts, retries and auth stay consistent across the app.
 */
export const apiClient = new HttpClient({
  baseUrl: env.apiBaseUrl,
  timeoutMs: env.apiTimeoutMs,
  retries: 2,
  // The session lives in httpOnly cookies, so every call must carry them.
  withCredentials: true,
});
