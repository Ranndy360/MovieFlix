/**
 * Error body shape emitted by MovieFlix-api's `AllExceptionsFilter`.
 * Keep in sync with `src/common/filters/all-exceptions.filter.ts` in the API.
 */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path?: string;
  method?: string;
  timestamp?: string;
}

export type ApiErrorKind =
  | 'network' // request never reached the server
  | 'timeout' // aborted by our own timeout
  | 'aborted' // aborted by the caller
  | 'client' // 4xx
  | 'server' // 5xx
  | 'parse'; // 2xx but the body was not the expected JSON

/**
 * The single error type every API call rejects with. Callers branch on
 * `status` / `kind` instead of string-matching messages.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly url: string;
  readonly body: ApiErrorBody | undefined;
  /** Field-level messages from `class-validator`, flattened for display. */
  readonly validationMessages: string[];

  constructor(params: {
    message: string;
    status: number;
    kind: ApiErrorKind;
    url: string;
    body?: ApiErrorBody | undefined;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = 'ApiError';
    this.status = params.status;
    this.kind = params.kind;
    this.url = params.url;
    this.body = params.body;
    this.validationMessages = Array.isArray(params.body?.message) ? params.body.message : [];

    // Required so `instanceof ApiError` survives transpilation to ES5 targets.
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isValidation(): boolean {
    return this.status === 400 || this.status === 422;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** True when retrying the exact same request could plausibly succeed. */
  get isRetryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.status >= 500;
  }

  /**
   * A single string safe to render in the UI.
   *
   * The API writes good copy for the rules it enforces — "You can only review a
   * movie you have marked as watched" is exactly what the user needs to read,
   * so domain messages pass through untouched. What does *not* pass through is
   * the framework's own vocabulary: "Forbidden resource", "Unauthorized" and a
   * bare "Internal server error" describe an HTTP status, not a person's
   * problem. Those, plus the failures that never reached the server at all, are
   * rewritten here so every caller gets a sentence worth showing.
   */
  toDisplayMessage(): string {
    if (this.validationMessages.length > 0) {
      return this.validationMessages.join(', ');
    }

    // Nothing reached the server, so there is no server message to prefer.
    switch (this.kind) {
      case 'network':
        return 'We could not reach MovieFlix. Check your connection and try again.';
      case 'timeout':
        return 'That request took too long. Try again in a moment.';
      case 'aborted':
        return 'That request was cancelled.';
      case 'parse':
        return 'We got an unexpected response. Try again in a moment.';
      default:
        break;
    }

    // A message the API wrote on purpose beats anything generic we could
    // substitute — "Too many failed attempts. Try again in 15 minutes." says
    // something ours cannot. Only the stock phrases get replaced.
    if (!GENERIC_SERVER_MESSAGES.has(this.message.trim().toLowerCase())) {
      return this.message;
    }

    if (this.kind === 'server') {
      return 'Something broke on our side. Try again in a moment — nothing you did caused this.';
    }

    switch (this.status) {
      case 401:
        return 'Your session has expired. Sign in again to pick up where you left off.';
      case 403:
        return 'You do not have permission to do that.';
      case 404:
        return 'We could not find that. It may have been removed.';
      case 429:
        return 'Too many attempts in a row. Wait a minute and try again.';
      default:
        return 'That did not go through. Try again in a moment.';
    }
  }
}

/** Nest's stock phrases — accurate, and useless to the person reading them. */
const GENERIC_SERVER_MESSAGES = new Set([
  'bad gateway',
  'bad request',
  'conflict',
  'forbidden',
  'forbidden resource',
  'gateway timeout',
  'internal server error',
  'not found',
  'request timeout',
  'service unavailable',
  'too many requests',
  'unauthorized',
  'unprocessable entity',
]);

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
