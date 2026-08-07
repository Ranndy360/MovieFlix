import { z } from 'zod';

/**
 * Environment contract, validated once at module load.
 *
 * `NEXT_PUBLIC_*` values are inlined into the client bundle by the compiler,
 * which means they must be referenced as full literal property accesses —
 * `process.env.NEXT_PUBLIC_API_BASE_URL`, never `process.env[key]`. That is why
 * the raw object below is spelled out instead of built dynamically.
 */
/**
 * An absolute `http(s)` URL, or a root-relative path.
 *
 * The relative form exists for the deployment where the API is proxied through
 * this app's own origin (see `rewrites` in `next.config.ts`). That is not a
 * cosmetic choice: served from the same origin, the API's `httpOnly` cookies
 * are *first-party*, which is what makes them survive Safari's tracking
 * prevention and Chrome's third-party cookie rules — and what lets
 * `middleware.ts` see them at all.
 */
const apiBaseUrl = z
  .string()
  .min(1)
  .refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), {
    message:
      'must be an absolute http(s) URL, or a root-relative path such as /api/v1 when the API is proxied through this app',
  });

const clientSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
  NEXT_PUBLIC_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('MovieFlix'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

const serverSchema = clientSchema.extend({
  /** Falls back to the public URL when the API is not behind a private network. */
  API_BASE_URL: z.string().url().optional(),
});

const rawClient = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

const isServer = typeof window === 'undefined';

const parsed = isServer
  ? serverSchema.safeParse({ ...rawClient, API_BASE_URL: process.env.API_BASE_URL })
  : clientSchema.safeParse(rawClient);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${details}`);
}

const values = parsed.data;

const serverBaseUrl = isServer
  ? ((values as z.infer<typeof serverSchema>).API_BASE_URL ?? values.NEXT_PUBLIC_API_BASE_URL)
  : values.NEXT_PUBLIC_API_BASE_URL;

/**
 * A relative base is meaningless on the server: there is no current document to
 * resolve it against, so `fetch('/api/v1/movies')` throws. The browser can use
 * the proxied path, but a Server Component has to be given the API's real
 * origin — which is what `API_BASE_URL` is for.
 */
if (isServer && serverBaseUrl.startsWith('/')) {
  throw new Error(
    'Invalid environment configuration:\n' +
      '  - API_BASE_URL: required, and must be absolute, when NEXT_PUBLIC_API_BASE_URL is a\n' +
      '    proxied path. Set it to the API origin, e.g. https://your-api.up.railway.app/api/v1',
  );
}

export const env = {
  appName: values.NEXT_PUBLIC_APP_NAME,
  appUrl: values.NEXT_PUBLIC_APP_URL,
  apiTimeoutMs: values.NEXT_PUBLIC_API_TIMEOUT_MS,

  /**
   * The API origin to use *from the current runtime*. On the server this
   * prefers `API_BASE_URL` (internal hostname); in the browser it is always
   * the public one.
   */
  apiBaseUrl: serverBaseUrl,

  isServer,
  isProduction: process.env.NODE_ENV === 'production',
} as const;

export type Env = typeof env;
