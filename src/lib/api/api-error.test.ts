/**
 * @jest-environment node
 */
import { ApiError, type ApiErrorKind } from './api-error';

function build(params: {
  message: string;
  status?: number;
  kind?: ApiErrorKind;
  validation?: string[];
}): ApiError {
  return new ApiError({
    message: params.message,
    status: params.status ?? 500,
    kind: params.kind ?? 'server',
    url: '/api/v1/movies',
    ...(params.validation
      ? { body: { statusCode: params.status ?? 400, message: params.validation, error: 'Bad Request' } }
      : {}),
  });
}

describe('ApiError.toDisplayMessage', () => {
  describe('failures that never reached the server', () => {
    it.each([
      ['network', /could not reach MovieFlix/i],
      ['timeout', /took too long/i],
      ['parse', /unexpected response/i],
    ] as const)('rewrites a %s failure', (kind, expected) => {
      expect(build({ message: 'Failed to fetch', kind, status: 0 }).toDisplayMessage()).toMatch(
        expected,
      );
    });
  });

  describe('messages the API wrote on purpose', () => {
    /**
     * The whole point of the rewrite rule: a specific server message beats
     * anything generic we could put in its place, so it must survive.
     */
    it('keeps a rate-limit message that names the wait', () => {
      const error = build({
        message: 'Too many failed attempts. Try again in 15 minutes.',
        status: 429,
        kind: 'client',
      });

      expect(error.toDisplayMessage()).toBe('Too many failed attempts. Try again in 15 minutes.');
    });

    it('keeps a business rule from a 422', () => {
      const error = build({
        message: 'You can only review a movie you have marked as watched.',
        status: 422,
        kind: 'client',
      });

      expect(error.toDisplayMessage()).toMatch(/marked as watched/);
    });

    it('keeps a conflict message', () => {
      const error = build({ message: 'That email is already registered.', status: 409, kind: 'client' });

      expect(error.toDisplayMessage()).toBe('That email is already registered.');
    });
  });

  describe("the framework's stock phrases", () => {
    it.each([
      ['Forbidden resource', 403, /do not have permission/i],
      ['Unauthorized', 401, /session has expired/i],
      ['Not Found', 404, /could not find that/i],
      ['Too Many Requests', 429, /too many attempts/i],
    ])('replaces %s', (message, status, expected) => {
      expect(build({ message, status, kind: 'client' }).toDisplayMessage()).toMatch(expected);
    });

    it('replaces a bare internal server error', () => {
      const error = build({ message: 'Internal server error', status: 500, kind: 'server' });

      expect(error.toDisplayMessage()).toMatch(/nothing you did caused this/i);
    });

    it('matches regardless of case or padding', () => {
      const error = build({ message: '  FORBIDDEN RESOURCE  ', status: 403, kind: 'client' });

      expect(error.toDisplayMessage()).toMatch(/do not have permission/i);
    });
  });

  it('prefers field-level validation messages over everything else', () => {
    const error = build({
      message: 'Bad Request',
      status: 400,
      kind: 'client',
      validation: ['title must be a string', 'releaseYear must not be less than 1888'],
    });

    expect(error.toDisplayMessage()).toBe(
      'title must be a string, releaseYear must not be less than 1888',
    );
  });

  it('falls back to a friendly line for an unmapped generic 4xx', () => {
    const error = build({ message: 'Bad Request', status: 418, kind: 'client' });

    expect(error.toDisplayMessage()).toMatch(/did not go through/i);
  });
});
