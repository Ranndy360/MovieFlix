/**
 * @jest-environment node
 *
 * Node, not jsdom: this suite needs the real `Response` / `Headers` / `fetch`
 * globals that jsdom does not implement.
 */
import { ApiError, isApiError } from './api-error';
import { buildQueryString, HttpClient } from './http-client';
import { emptyResponse, jsonResponse, mockFetch, textResponse } from '@/testing/mock-fetch';

const BASE_URL = 'http://api.test/api/v1';

describe('buildQueryString', () => {
  it('returns an empty string when there is nothing to serialize', () => {
    expect(buildQueryString(undefined)).toBe('');
    expect(buildQueryString({})).toBe('');
  });

  it('serializes primitives', () => {
    expect(buildQueryString({ page: 2, search: 'dune', isPublished: true })).toBe(
      '?page=2&search=dune&isPublished=true',
    );
  });

  it('drops undefined, null and empty-string values', () => {
    expect(buildQueryString({ page: 1, genre: undefined, search: '', tag: null })).toBe('?page=1');
  });

  it('keeps zero and false, which are meaningful values', () => {
    expect(buildQueryString({ rating: 0, isPublished: false })).toBe('?rating=0&isPublished=false');
  });

  it('repeats the key for array values', () => {
    expect(buildQueryString({ genre: ['HORROR', 'DRAMA'] })).toBe('?genre=HORROR&genre=DRAMA');
  });

  it('url-encodes special characters', () => {
    expect(buildQueryString({ search: 'a&b c' })).toBe('?search=a%26b+c');
  });
});

describe('HttpClient', () => {
  let client: HttpClient;
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    fetchMock = mockFetch();
    client = new HttpClient({ baseUrl: BASE_URL, timeoutMs: 1000 });
  });

  describe('url building', () => {
    it('joins the base url and path', () => {
      expect(client.resolveUrl('/movies')).toBe(`${BASE_URL}/movies`);
    });

    it('tolerates a missing leading slash', () => {
      expect(client.resolveUrl('movies')).toBe(`${BASE_URL}/movies`);
    });

    it('strips a trailing slash from the base url', () => {
      const trailing = new HttpClient({ baseUrl: `${BASE_URL}/` });
      expect(trailing.resolveUrl('/movies')).toBe(`${BASE_URL}/movies`);
    });

    it('appends the query string', () => {
      expect(client.resolveUrl('/movies', { page: 3 })).toBe(`${BASE_URL}/movies?page=3`);
    });
  });

  describe('successful requests', () => {
    it('GETs and parses a JSON body', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: '1', title: 'Dune' }));

      await expect(client.get('/movies/1')).resolves.toEqual({ id: '1', title: 'Dune' });
      expect(fetchMock.lastUrl()).toBe(`${BASE_URL}/movies/1`);
      expect(fetchMock.lastInit().method).toBe('GET');
    });

    it('sends the query object as a query string', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ items: [] }));

      await client.get('/movies', { query: { page: 2, search: 'blade' } });

      expect(fetchMock.lastUrl()).toBe(`${BASE_URL}/movies?page=2&search=blade`);
    });

    it('POSTs a JSON body with the right content type', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: '1' }, 201));

      await client.post('/movies', { title: 'Dune' });

      const init = fetchMock.lastInit();
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ title: 'Dune' }));
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('PATCHes a partial payload', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: '1', title: 'New' }));

      await client.patch('/movies/1', { title: 'New' });

      expect(fetchMock.lastInit().method).toBe('PATCH');
    });

    it('resolves to undefined on 204 No Content', async () => {
      fetchMock.mockResolvedValue(emptyResponse(204));

      await expect(client.delete('/movies/1')).resolves.toBeUndefined();
    });

    it('returns raw text for a non-JSON content type', async () => {
      fetchMock.mockResolvedValue(textResponse('pong'));

      await expect(client.get<string>('/ping')).resolves.toBe('pong');
    });

    it('does not send a body on GET', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));

      await client.get('/movies');

      expect(fetchMock.lastInit().body).toBeUndefined();
    });

    it('merges default and per-request headers', async () => {
      const withDefaults = new HttpClient({
        baseUrl: BASE_URL,
        defaultHeaders: { 'X-Client': 'movieflix-web' },
      });
      fetchMock.mockResolvedValue(jsonResponse({}));

      await withDefaults.get('/movies', { headers: { 'X-Request-Id': 'abc' } });

      const headers = fetchMock.lastInit().headers as Record<string, string>;
      expect(headers['X-Client']).toBe('movieflix-web');
      expect(headers['X-Request-Id']).toBe('abc');
      expect(headers['Accept']).toBe('application/json');
    });
  });

  describe('authentication', () => {
    it('attaches a bearer token when the provider returns one', async () => {
      const authed = new HttpClient({ baseUrl: BASE_URL, getAuthToken: () => 'token-123' });
      fetchMock.mockResolvedValue(jsonResponse({}));

      await authed.get('/movies');

      expect((fetchMock.lastInit().headers as Record<string, string>)['Authorization']).toBe(
        'Bearer token-123',
      );
    });

    it('supports an async token provider', async () => {
      const authed = new HttpClient({
        baseUrl: BASE_URL,
        getAuthToken: () => Promise.resolve('async-token'),
      });
      fetchMock.mockResolvedValue(jsonResponse({}));

      await authed.get('/movies');

      expect((fetchMock.lastInit().headers as Record<string, string>)['Authorization']).toBe(
        'Bearer async-token',
      );
    });

    it('omits the header for an anonymous call', async () => {
      const authed = new HttpClient({ baseUrl: BASE_URL, getAuthToken: () => undefined });
      fetchMock.mockResolvedValue(jsonResponse({}));

      await authed.get('/movies');

      expect(fetchMock.lastInit().headers as Record<string, string>).not.toHaveProperty(
        'Authorization',
      );
    });
  });

  describe('error translation', () => {
    it('maps a 404 to a client ApiError', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { statusCode: 404, message: 'Movie with id "x" was not found', error: 'Not Found' },
          404,
        ),
      );

      const error = await client.get('/movies/x').catch((e: unknown) => e);

      expect(isApiError(error)).toBe(true);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(404);
      expect(apiError.kind).toBe('client');
      expect(apiError.isNotFound).toBe(true);
      expect(apiError.message).toBe('Movie with id "x" was not found');
    });

    it('flattens class-validator messages into validationMessages', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          {
            statusCode: 400,
            message: ['title must be a string', 'genre must be a valid enum value'],
            error: 'Bad Request',
          },
          400,
        ),
      );

      const error = (await client.post('/movies', {}).catch((e: unknown) => e)) as ApiError;

      expect(error.isValidation).toBe(true);
      expect(error.validationMessages).toHaveLength(2);
      expect(error.toDisplayMessage()).toBe(
        'title must be a string, genre must be a valid enum value',
      );
    });

    it('flags a 409 as a conflict', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ statusCode: 409, message: 'title must be unique', error: 'Conflict' }, 409),
      );

      const error = (await client.post('/movies', {}).catch((e: unknown) => e)) as ApiError;

      expect(error.isConflict).toBe(true);
    });

    it('flags 401/403 as unauthorized', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ statusCode: 401, message: 'nope' }, 401));

      const error = (await client.get('/movies').catch((e: unknown) => e)) as ApiError;

      expect(error.isUnauthorized).toBe(true);
    });

    it('marks a 5xx as a retryable server error', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ statusCode: 500, message: 'boom' }, 500));

      const error = (await client.get('/movies').catch((e: unknown) => e)) as ApiError;

      expect(error.kind).toBe('server');
      expect(error.isRetryable).toBe(true);
    });

    it('falls back to the status text when the error body is not JSON', async () => {
      fetchMock.mockResolvedValue(new Response('<html>502</html>', { status: 502 }));

      const error = (await client.get('/movies').catch((e: unknown) => e)) as ApiError;

      expect(error.status).toBe(502);
      expect(error.message).toContain('502');
    });

    it('wraps a transport failure as a network error', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      const error = (await client.get('/movies').catch((e: unknown) => e)) as ApiError;

      expect(error.kind).toBe('network');
      expect(error.status).toBe(0);
      expect(error.isRetryable).toBe(true);
    });

    it('reports unparseable JSON on a 200 as a parse error', async () => {
      fetchMock.mockResolvedValue(
        new Response('{not json', { status: 200, headers: { 'content-type': 'application/json' } }),
      );

      const error = (await client.get('/movies').catch((e: unknown) => e)) as ApiError;

      expect(error.kind).toBe('parse');
    });

    it('calls onError once with the final error', async () => {
      const onError = jest.fn();
      const observed = new HttpClient({ baseUrl: BASE_URL, onError });
      fetchMock.mockResolvedValue(jsonResponse({ statusCode: 404, message: 'gone' }, 404));

      await observed.get('/movies/x').catch(() => undefined);

      expect(onError).toHaveBeenCalledTimes(1);
      expect((onError.mock.calls[0][0] as ApiError).status).toBe(404);
    });
  });

  describe('timeout and cancellation', () => {
    it('aborts a request that exceeds the timeout', async () => {
      const slow = new HttpClient({ baseUrl: BASE_URL, timeoutMs: 20 });
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );

      const error = (await slow.get('/movies').catch((e: unknown) => e)) as ApiError;

      expect(error.kind).toBe('timeout');
      expect(error.message).toContain('timed out');
    });

    it('surfaces a caller-initiated abort as kind "aborted"', async () => {
      const controller = new AbortController();
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );

      const promise = client.get('/movies', { signal: controller.signal });
      controller.abort();

      const error = (await promise.catch((e: unknown) => e)) as ApiError;

      expect(error.kind).toBe('aborted');
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('retries', () => {
    it('retries a retryable GET and succeeds', async () => {
      const retrying = new HttpClient({ baseUrl: BASE_URL, retries: 2 });
      fetchMock
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));

      await expect(retrying.get('/movies')).resolves.toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('gives up after exhausting the retries', async () => {
      const retrying = new HttpClient({ baseUrl: BASE_URL, retries: 1 });
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(retrying.get('/movies')).rejects.toBeInstanceOf(ApiError);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry a 4xx', async () => {
      const retrying = new HttpClient({ baseUrl: BASE_URL, retries: 3 });
      fetchMock.mockResolvedValue(jsonResponse({ statusCode: 400, message: 'bad' }, 400));

      await expect(retrying.get('/movies')).rejects.toBeInstanceOf(ApiError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry a non-idempotent POST by default', async () => {
      const retrying = new HttpClient({ baseUrl: BASE_URL, retries: 3 });
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(retrying.post('/movies', {})).rejects.toBeInstanceOf(ApiError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('honours a per-request retry override', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(client.post('/movies', {}, { retries: 1 })).rejects.toBeInstanceOf(ApiError);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
