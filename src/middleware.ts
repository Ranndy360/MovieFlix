import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'mf_access';
const REFRESH_COOKIE = 'mf_refresh';

/**
 * Paths that require a session, matched by prefix.
 *
 * `/` is NOT in here: `'/login'.startsWith('/')` is true, so a `/` prefix
 * would capture every route including the sign-in page and loop forever.
 * The home page is matched exactly instead.
 */
const PROTECTED_PREFIXES = ['/admin', '/movies', '/my-list', '/profile'];

/** Routes protected by exact match. */
const PROTECTED_EXACT = ['/'];

/** Signed-in users have no business on these. */
const AUTH_ONLY_PREFIXES = ['/login', '/signup'];

/**
 * Edge-level routing courtesy — **not** an authorization boundary.
 *
 * The tokens are `httpOnly` and signed with a secret this middleware
 * deliberately does not hold, so all it can do is observe whether a cookie is
 * *present*. A forged cookie would sail past here and then be rejected by the
 * API on the very first data request.
 *
 * Keeping it presence-only is the deliberate choice: verifying signatures here
 * would duplicate the API's auth logic in a second place, and the two would
 * drift. Real enforcement lives in `JwtAuthGuard` + `RolesGuard`, which also
 * re-read the user's role from the database on every request — something no
 * cookie inspection can do.
 */
/**
 * Whether the auth cookie can reach *this* origin at all.
 *
 * Cookies belong to a registrable domain, not to a project. When the API is
 * called directly on another host — the app on `*.vercel.app`, the API on
 * `*.up.railway.app` — the browser never sends `mf_access` here, so the check
 * below would read "signed out" for everyone and bounce every protected route
 * to `/login`, forever.
 *
 * Detected rather than configured: a relative `NEXT_PUBLIC_API_BASE_URL` means
 * the API is proxied through this origin (see `rewrites` in next.config.ts) and
 * the cookies are ours to read. An absolute URL means they are not.
 *
 * When they are not, this middleware steps aside and `useRequireAuth` does the
 * gating in the browser, where the session actually is. Nothing is lost:
 * middleware was never the security boundary — the API re-checks every request
 * and re-reads the role from the database.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/** `null` when the API is proxied through this origin — same host by definition. */
const API_HOSTNAME = ((): string | null => {
  if (!API_BASE || API_BASE.startsWith('/')) return null;

  try {
    return new URL(API_BASE).hostname;
  } catch {
    return null;
  }
})();

/**
 * Hosts, not origins: a cookie ignores the port, which is why `localhost:3000`
 * and `localhost:3001` share one in development and this check keeps working
 * there unchanged.
 */
function canSeeSessionCookie(hostname: string): boolean {
  return API_HOSTNAME === null || API_HOSTNAME === hostname;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (!canSeeSessionCookie(request.nextUrl.hostname)) return NextResponse.next();

  const hasSession =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  const isProtected =
    PROTECTED_EXACT.includes(pathname) ||
    PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && hasSession) {
    return NextResponse.redirect(new URL('/movies', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and static assets — they never need a session check.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
