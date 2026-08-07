/**
 * @jest-environment node
 *
 * Covers the auth-specific behaviour of the HTTP client: credentialed
 * requests, and the single-flight refresh-on-401.
 */
import { HttpClient } from './http-client';
import { jsonResponse, mockFetch } from '@/testing/mock-fetch';

const BASE_URL = 'http://api.test/api/v1';

describe('HttpClient — credentials', () => {
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    fetchMock = mockFetch();
  });

  it('sends cookies when withCredentials is on', async () => {
    const client = new HttpClient({ baseUrl: BASE_URL, withCredentials: true });
    fetchMock.mockResolvedValue(jsonResponse({}));

    await client.get('/auth/me');

    expect(fetchMock.lastInit().credentials).toBe('include');
  });

  it('omits credentials by default', async () => {
    const client = new HttpClient({ baseUrl: BASE_URL });
    fetchMock.mockResolvedValue(jsonResponse({}));

    await client.get('/movies');

    expect(fetchMock.lastInit().credentials).toBeUndefined();
  });
});

describe('HttpClient — refresh on 401', () => {
  let fetchMock: ReturnType<typeof mockFetch>;

  const unauthorizedOnce = (): void => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ statusCode: 401, message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
  };

  beforeEach(() => {
    fetchMock = mockFetch();
  });

  it('refreshes then replays the original request', async () => {
    const onUnauthorized = jest.fn().mockResolvedValue(true);
    const client = new HttpClient({ baseUrl: BASE_URL, onUnauthorized });
    unauthorizedOnce();

    await expect(client.get('/movies')).resolves.toEqual({ ok: true });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up when the refresh fails', async () => {
    const onUnauthorized = jest.fn().mockResolvedValue(false);
    const client = new HttpClient({ baseUrl: BASE_URL, onUnauthorized });
    fetchMock.mockResolvedValue(jsonResponse({ statusCode: 401, message: 'expired' }, 401));

    await expect(client.get('/movies')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('refreshes at most once per request — no infinite loop', async () => {
    const onUnauthorized = jest.fn().mockResolvedValue(true);
    const client = new HttpClient({ baseUrl: BASE_URL, onUnauthorized });
    // Still 401 even after a "successful" refresh: a genuine permission issue.
    fetchMock.mockResolvedValue(jsonResponse({ statusCode: 401, message: 'nope' }, 401));

    await expect(client.get('/movies')).rejects.toMatchObject({ status: 401 });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips the refresh when the caller opts out', async () => {
    const onUnauthorized = jest.fn().mockResolvedValue(true);
    const client = new HttpClient({ baseUrl: BASE_URL, onUnauthorized });
    fetchMock.mockResolvedValue(jsonResponse({ statusCode: 401, message: 'bad creds' }, 401));

    await expect(client.post('/auth/login', {}, { skipAuthRefresh: true })).rejects.toMatchObject({
      status: 401,
    });

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not refresh on a 403 — that is authorization, not expiry', async () => {
    const onUnauthorized = jest.fn().mockResolvedValue(true);
    const client = new HttpClient({ baseUrl: BASE_URL, onUnauthorized });
    fetchMock.mockResolvedValue(jsonResponse({ statusCode: 403, message: 'forbidden' }, 403));

    await expect(client.get('/users')).rejects.toMatchObject({ status: 403 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('coalesces concurrent 401s into ONE refresh', async () => {
    let resolveRefresh: ((value: boolean) => void) | undefined;
    const onUnauthorized = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const client = new HttpClient({ baseUrl: BASE_URL, onUnauthorized });

    // A fresh Response per call: a body can only be consumed once, so a shared
    // instance would fail with "Body is unusable" on the second read.
    let call = 0;
    fetchMock.mockImplementation(() => {
      call += 1;
      return Promise.resolve(call <= 3 ? jsonResponse({ statusCode: 401 }, 401) : jsonResponse({ ok: true }));
    });

    const requests = Promise.all([
      client.get('/movies'),
      client.get('/users'),
      client.get('/auth/me'),
    ]);

    // Let all three hit their 401 and queue behind the same refresh.
    await new Promise((resolve) => setImmediate(resolve));
    resolveRefresh?.(true);

    await expect(requests).resolves.toEqual([{ ok: true }, { ok: true }, { ok: true }]);

    // Three concurrent rotations would have invalidated each other and tripped
    // the API's reuse detection.
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('allows a fresh refresh after the previous one settled', async () => {
    const onUnauthorized = jest.fn().mockResolvedValue(true);
    const client = new HttpClient({ baseUrl: BASE_URL, onUnauthorized });

    unauthorizedOnce();
    await client.get('/movies');

    unauthorizedOnce();
    await client.get('/movies');

    expect(onUnauthorized).toHaveBeenCalledTimes(2);
  });

  it('can have its handler registered after construction', async () => {
    const client = new HttpClient({ baseUrl: BASE_URL });
    const onUnauthorized = jest.fn().mockResolvedValue(true);
    client.setUnauthorizedHandler(onUnauthorized);
    unauthorizedOnce();

    await expect(client.get('/movies')).resolves.toEqual({ ok: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
