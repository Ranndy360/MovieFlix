/**
 * Helpers for stubbing `globalThis.fetch` in specs.
 *
 * The HTTP client is the app's only network boundary, so mocking `fetch` here
 * is the highest-fidelity way to test it: the real serialization, header and
 * status-handling code all still runs.
 */

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const emptyResponse = (status = 204): Response => new Response(null, { status });

export const textResponse = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/plain' } });

export interface FetchMock extends jest.Mock {
  lastUrl: () => string;
  lastInit: () => RequestInit;
}

/** Installs a jest mock on `globalThis.fetch` and returns it. */
export const mockFetch = (): FetchMock => {
  const fn = jest.fn() as FetchMock;

  fn.lastUrl = () => String(fn.mock.calls.at(-1)?.[0]);
  fn.lastInit = () => (fn.mock.calls.at(-1)?.[1] ?? {}) as RequestInit;

  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
};
