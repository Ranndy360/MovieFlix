/**
 * @jest-environment node
 *
 * `env.ts` validates at import time, so each case needs a fresh module
 * registry with the environment already in place.
 */
import type * as EnvModule from './env';

const ORIGINAL = process.env;

function loadEnv(overrides: Record<string, string | undefined>): { apiBaseUrl: string } {
  let loaded!: { apiBaseUrl: string };

  jest.isolateModules(() => {
    process.env = { ...ORIGINAL, ...overrides };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = (require('./env') as typeof EnvModule).env;
  });

  return loaded;
}

describe('env.apiBaseUrl', () => {
  afterEach(() => {
    process.env = ORIGINAL;
  });

  it('accepts an absolute API origin', () => {
    const env = loadEnv({
      NEXT_PUBLIC_API_BASE_URL: 'https://api.example.com/api/v1',
      API_BASE_URL: 'https://api.example.com/api/v1',
    });

    expect(env.apiBaseUrl).toBe('https://api.example.com/api/v1');
  });

  it('accepts a proxied path for the browser, with an absolute server URL', () => {
    // The Vercel + Railway shape: same-origin in the browser, direct on the server.
    const env = loadEnv({
      NEXT_PUBLIC_API_BASE_URL: '/api/v1',
      API_BASE_URL: 'https://moviefix-api.up.railway.app/api/v1',
    });

    expect(env.apiBaseUrl).toBe('https://moviefix-api.up.railway.app/api/v1');
  });

  it('refuses a proxied path with no absolute server URL behind it', () => {
    // `fetch('/api/v1/movies')` on the server has nothing to resolve against,
    // so this must fail at boot rather than on the first render.
    expect(() =>
      loadEnv({ NEXT_PUBLIC_API_BASE_URL: '/api/v1', API_BASE_URL: undefined }),
    ).toThrow(/API_BASE_URL/);
  });

  it('refuses a value that is neither', () => {
    expect(() =>
      loadEnv({ NEXT_PUBLIC_API_BASE_URL: 'api.example.com', API_BASE_URL: undefined }),
    ).toThrow(/absolute http\(s\) URL/);
  });

  it('still requires the variable to be set at all', () => {
    expect(() =>
      loadEnv({ NEXT_PUBLIC_API_BASE_URL: undefined, API_BASE_URL: undefined }),
    ).toThrow(/Invalid environment configuration/);
  });
});
