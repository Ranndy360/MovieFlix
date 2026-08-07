'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { RequireRole } from '@/features/auth/components/require-role';
import { cn } from '@/lib/utils/cn';
import { useAuthActions, useAuthStatus, useAuthUser } from '@/store/auth.store';
import { useWatchlistActions } from '@/store/watchlist.store';
import { ROLE_LABELS } from '@/types/auth';

// Every destination needs a session now, so none of these are shown signed out.
const NAV_LINKS = [
  { href: '/', label: 'Home', authOnly: true },
  { href: '/movies', label: 'Browse', authOnly: true },
  { href: '/my-list', label: 'My List', authOnly: true },
];

/**
 * Netflix-style top bar: transparent over the hero, solid once scrolled.
 *
 * The transparency is what makes the billboard feel full-bleed, and the switch
 * to solid is what keeps the links readable over a bright row further down.
 */
export function SiteHeader(): React.JSX.Element {
  const pathname = usePathname();
  const status = useAuthStatus();
  const user = useAuthUser();
  const { logout } = useAuthActions();
  const { clear } = useWatchlistActions();

  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setIsScrolled(window.scrollY > 24);
    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A route change should never leave the mobile menu hanging open.
  useEffect(() => setMenuOpen(false), [pathname]);

  /**
   * Signing out leaves via a full page load, not the client router.
   *
   * Two reasons, and the first is a bug this used to cause. `logout()` flips
   * the store to `unauthenticated`, which makes `useRequireAuth` on the current
   * protected page fire its own `router.replace` on the same tick. A second
   * `replace` plus a `refresh` racing that one could cancel the navigation
   * outright, leaving the user parked on a protected page that renders nothing
   * but its "checking your session" skeleton — with no effect left to re-run,
   * so it never recovered.
   *
   * The second reason is that a session boundary *should* be a hard boundary:
   * a new document throws away every Zustand store and the whole router cache,
   * which is the only way to be certain no fragment of the previous user's data
   * survives into the next session.
   */
  async function handleSignOut(): Promise<void> {
    await logout();
    // Belt and braces — the reload discards this too, but the list must be gone
    // even if the navigation is somehow blocked.
    clear();
    window.location.assign('/login');
  }

  const links = NAV_LINKS.filter((link) => !link.authOnly || user !== null);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-colors duration-300',
        isScrolled || menuOpen ? 'bg-canvas shadow-lg' : 'bg-gradient-to-b from-black/80 to-transparent',
      )}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-12">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-xl font-black uppercase tracking-tighter text-brand md:text-2xl"
          >
            MovieFlix
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-5 md:flex">
            {links.map((link) => {
              const isActive =
                link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'text-sm transition-colors hover:text-content-muted',
                    isActive ? 'font-semibold text-white' : 'text-content-muted',
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            <RequireRole roles={['ADMIN', 'PROVIDER']}>
              <Link
                href="/admin/movies"
                className={cn(
                  'text-sm transition-colors hover:text-content-muted',
                  pathname === '/admin/movies' ? 'font-semibold text-white' : 'text-content-muted',
                )}
              >
                Manage
              </Link>
            </RequireRole>

            <RequireRole roles={['ADMIN']}>
              <Link
                href="/admin/users"
                className={cn(
                  'text-sm transition-colors hover:text-content-muted',
                  pathname.startsWith('/admin/users')
                    ? 'font-semibold text-white'
                    : 'text-content-muted',
                )}
              >
                Users
              </Link>
            </RequireRole>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {status === 'idle' || status === 'loading' ? (
            <div aria-hidden="true" className="h-8 w-20 animate-pulse rounded bg-surface-2" />
          ) : user ? (
            <>
              <Link
                href="/profile"
                className="hidden text-right leading-tight sm:block"
                aria-label={`Profile: ${user.fullName}`}
              >
                <span className="block text-xs font-medium">{user.fullName}</span>
                <span className="block text-[11px] text-content-faint">
                  {ROLE_LABELS[user.role]}
                </span>
              </Link>

              <Link
                href="/profile"
                aria-label="Profile"
                className="flex h-8 w-8 items-center justify-center rounded bg-brand text-sm font-bold text-white"
              >
                {user.firstName.charAt(0).toUpperCase()}
              </Link>

              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="hidden text-xs text-content-muted transition-colors hover:text-white md:block"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-sm bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Sign In
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation"
            className="md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" d={menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line px-4 pb-4 md:hidden">
          <ul className="flex flex-col gap-1 pt-3">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="block py-2 text-sm text-content-muted">
                  {link.label}
                </Link>
              </li>
            ))}
            <RequireRole roles={['ADMIN', 'PROVIDER']}>
              <li>
                <Link href="/admin/movies" className="block py-2 text-sm text-content-muted">
                  Manage
                </Link>
              </li>
            </RequireRole>
            <RequireRole roles={['ADMIN']}>
              <li>
                <Link href="/admin/users" className="block py-2 text-sm text-content-muted">
                  Users
                </Link>
              </li>
            </RequireRole>
            {user ? (
              <li>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="block py-2 text-sm text-content-muted"
                >
                  Sign out
                </button>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
