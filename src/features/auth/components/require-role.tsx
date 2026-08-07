'use client';

import { useAuthStatus, useAuthUser } from '@/store/auth.store';
import type { Role } from '@/types/auth';

export interface RequireRoleProps {
  /** Any one of these is enough (OR), matching the API's `@Roles(...)`. */
  roles: Role[];
  children: React.ReactNode;
  /** Rendered when the check fails. Defaults to rendering nothing. */
  fallback?: React.ReactNode;
  /** Rendered while the session is still being resolved. */
  pending?: React.ReactNode;
}

/**
 * Conditionally renders by role.
 *
 * **This is UI convenience, not access control.** Anyone can edit the
 * JavaScript that runs on their own machine, so hiding a button hides nothing
 * of value. The real check is `RolesGuard` on the API, which re-reads the role
 * from the database on every single request.
 */
export function RequireRole({
  roles,
  children,
  fallback = null,
  pending = null,
}: RequireRoleProps): React.JSX.Element {
  const status = useAuthStatus();
  const user = useAuthUser();

  if (status === 'idle' || status === 'loading') {
    return <>{pending}</>;
  }

  if (!user || !roles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
