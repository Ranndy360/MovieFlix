import { z } from 'zod';

/**
 * Environment contract, validated once at module load.
 *
 * `NEXT_PUBLIC_*` values are inlined into the client bundle by the compiler,
 * which means they must be referenced as full literal property accesses —
 * `process.env.NEXT_PUBLIC_API_BASE_URL`, never `process.env[key]`. That is why
 * the raw object below is spelled out instead of built dynamically.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
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

export const env = {
  appName: values.NEXT_PUBLIC_APP_NAME,
  appUrl: values.NEXT_PUBLIC_APP_URL,
  apiTimeoutMs: values.NEXT_PUBLIC_API_TIMEOUT_MS,

  /**
   * The API origin to use *from the current runtime*. On the server this
   * prefers `API_BASE_URL` (internal hostname); in the browser it is always
   * the public one.
   */
  apiBaseUrl: isServer
    ? ((values as z.infer<typeof serverSchema>).API_BASE_URL ?? values.NEXT_PUBLIC_API_BASE_URL)
    : values.NEXT_PUBLIC_API_BASE_URL,

  isServer,
  isProduction: process.env.NODE_ENV === 'production',
} as const;

export type Env = typeof env;
