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
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

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
