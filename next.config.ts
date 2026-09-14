import type { NextConfig } from 'next';

/**
 * Where to forward `/api/*` when the API lives on another host.
 *
 * Set this in production (e.g. `https://moviefix-api.up.railway.app`) and the
 * browser stops talking to that host directly: it calls this app's own origin,
 * and Next proxies the request onward. Three problems disappear at once.
 *
 * 1. **CORS.** Same-origin requests are not subject to it. No allow-list to
 *    keep in sync with every Vercel preview URL.
 * 2. **Cookies.** The API's `httpOnly` cookies arrive on *this* origin, so they
 *    are first-party. Cross-site they would need `SameSite=None`, which Safari
 *    blocks outright and Chrome is in the process of restricting — the session
 *    would simply evaporate for a share of users.
 * 3. **`middleware.ts`.** It gates routes by looking for the auth cookie. A
 *    cookie set on a different registrable domain is never sent here, so
 *    cross-site every protected route would bounce to `/login` forever.
 *
 * Left unset — as in local development, where both run on `localhost` and the
 * cookies are already shared — nothing is rewritten.
 */
const apiProxyOrigin = process.env.API_PROXY_ORIGIN?.replace(/\/+$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * Emits `.next/standalone`: a self-contained server plus only the modules it
   * actually imports. It is what lets the Docker image ship without
   * `node_modules`, taking the runtime image from ~1GB to ~200MB.
   *
   * Harmless outside Docker — `next dev` and `next start` ignore it.
   */
  output: 'standalone',

  // Fail the production build on a type or lint error rather than shipping it.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  images: {
    /**
     * `next/image` refuses any host that is not listed here, so every source
     * of poster artwork needs an entry. Supabase Storage serves uploads from
     * `<project>.supabase.co/storage/v1/object/public/...`; the wildcard keeps
     * this working if the project ref changes between environments.
     */
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'loremflickr.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },

  async rewrites() {
    if (!apiProxyOrigin) return [];

    // `middleware.ts` already excludes `/api` from its matcher, so a proxied
    // call is never mistaken for a page navigation and redirected to /login.
    return [{ source: '/api/:path*', destination: `${apiProxyOrigin}/api/:path*` }];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
