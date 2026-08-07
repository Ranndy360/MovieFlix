'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuthStatus, useAuthUser } from '@/store/auth.store';
import type { Role } from '@/types/auth';

export interface UseRequireAuthResult {
  isAllowed: boolean;
  /** True while the session is still resolving — render a skeleton, not a denial. */
  isPending: boolean;
}

/**
 * Client-side route protection: redirects away when the visitor is not signed
 * in, or lacks one of `roles`.
 *
 * Again, this is UX rather than security. It exists so a signed-out user lands
 * on the login page instead of watching a screen of failed requests; the data
 * itself is protected by the API.
 */
export function useRequireAuth(roles?: Role[], redirectTo = '/login'): UseRequireAuthResult {
  const router = useRouter();
  const status = useAuthStatus();
  const user = useAuthUser();

  const isPending = status === 'idle' || status === 'loading';
  const isAuthenticated = status === 'authenticated' && user !== null;
  const hasRole = !roles || (user !== null && roles.includes(user.role));
  const isAllowed = isAuthenticated && hasRole;

  useEffect(() => {
    if (isPending) return;

    if (!isAuthenticated) {
      // A full load, not `router.replace`. Callers render a skeleton while
      // `isAllowed` is false and have no other exit, so a client navigation
      // that gets cancelled — by a competing `replace`, or a `refresh` landing
      // mid-flight — strands the page on that skeleton forever: the effect's
      // dependencies have not changed, so nothing tries again.
      //
      // `replace`, not `assign`: the protected URL must not sit in history
      // where Back would bounce the user through it again.
      //
      // This path is rarer than it looks. The middleware already turns away a
      // visitor with no cookie before the page renders, so what reaches here is
      // a session that died while the tab was open — an expiry or a revocation.
      // A reload is the right response to that anyway.
      window.location.replace(
        `${redirectTo}?next=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }

    if (!hasRole) {
      router.replace('/forbidden');
    }
  }, [isPending, isAuthenticated, hasRole, redirectTo, router]);

  return { isAllowed, isPending };
}
