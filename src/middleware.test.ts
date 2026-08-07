/**
 * @jest-environment node
 *
 * The module reads `NEXT_PUBLIC_API_BASE_URL` once, at load, so each topology
 * needs a fresh registry.
 */
import type { NextRequest } from 'next/server';

const ORIGINAL = process.env;

type Middleware = (request: NextRequest) => { status: number; headers: Headers };

function loadMiddleware(apiBaseUrl: string): Middleware {
  let loaded!: Middleware;

  jest.isolateModules(() => {
    process.env = { ...ORIGINAL, NEXT_PUBLIC_API_BASE_URL: apiBaseUrl };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = (require('./middleware') as { middleware: Middleware }).middleware;
  });

  return loaded;
}

/** The slice of NextRequest the middleware actually touches. */
function requestFor(url: string, cookies: string[] = []): NextRequest {
  const parsed = new URL(url);

  return {
    nextUrl: parsed,
    url,
    cookies: { has: (name: string) => cookies.includes(name) },
  } as unknown as NextRequest;
}

const locationOf = (result: { headers: Headers }): string | null => result.headers.get('location');

describe('middleware', () => {
  afterEach(() => {
    process.env = ORIGINAL;
  });

  describe('when the session cookie is visible to this origin', () => {
    // Development: different ports, same host — a cookie ignores the port.
    const middleware = (): Middleware => loadMiddleware('http://localhost:3001/api/v1');

    it('sends an anonymous visitor from a protected route to the login page', () => {
      const result = middleware()(requestFor('http://localhost:3000/movies'));

      expect(result.status).toBe(307);
      expect(locationOf(result)).toContain('/login?next=%2Fmovies');
    });

    it('protects the home page by exact match', () => {
      expect(locationOf(middleware()(requestFor('http://localhost:3000/')))).toContain('/login');
    });

    it('lets a visitor with a session through', () => {
      const result = middleware()(requestFor('http://localhost:3000/movies', ['mf_access']));

      expect(locationOf(result)).toBeNull();
    });

    it('keeps a signed-in visitor off the login page', () => {
      const result = middleware()(requestFor('http://localhost:3000/login', ['mf_access']));

      expect(locationOf(result)).toContain('/movies');
    });

    it('leaves the login page alone for a signed-out visitor', () => {
      expect(locationOf(middleware()(requestFor('http://localhost:3000/login')))).toBeNull();
    });
  });

  describe('when the API is on another host', () => {
    /**
     * The Vercel + Railway shape. `mf_access` belongs to the API's domain and
     * is never sent here, so a cookie check would read "signed out" for
     * everyone and bounce every protected route to /login, forever.
     */
    const middleware = (): Middleware =>
      loadMiddleware('https://moviefix-api.up.railway.app/api/v1');

    it('stops gating and defers to the client-side guard', () => {
      const result = middleware()(requestFor('https://moviefix.vercel.app/movies'));

      expect(locationOf(result)).toBeNull();
    });

    it('does not bounce a signed-in visitor away from the login page either', () => {
      const result = middleware()(requestFor('https://moviefix.vercel.app/login'));

      expect(locationOf(result)).toBeNull();
    });
  });

  describe('when the API is proxied through this origin', () => {
    // A relative base means same-origin, so the cookies are ours to read.
    const middleware = (): Middleware => loadMiddleware('/api/v1');

    it('gates as usual', () => {
      const result = middleware()(requestFor('https://moviefix.vercel.app/profile'));

      expect(locationOf(result)).toContain('/login?next=%2Fprofile');
    });

    it('recognises the session', () => {
      const result = middleware()(requestFor('https://moviefix.vercel.app/profile', ['mf_access']));

      expect(locationOf(result)).toBeNull();
    });
  });
});
