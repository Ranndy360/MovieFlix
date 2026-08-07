'use client';

import { useEffect, useRef } from 'react';

import { refreshSession } from '@/features/auth/api/auth.api';
import { apiClient } from '@/lib/api';
import { resetAuthState, useAuthActions, useAuthStore } from '@/store/auth.store';

/**
 * Boots the session once per page load and teaches the HTTP client how to
 * recover from an expired access cookie.
 *
 * Mounted high in the tree (see `app/layout.tsx`). It renders its children
 * immediately — bootstrapping is not a blocking gate, so public pages paint
 * without waiting on `/auth/me`.
 */
export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { bootstrap } = useAuthActions();
  const started = useRef(false);

  useEffect(() => {
    // React 18 StrictMode double-invokes effects in development; without this
    // the app fires two `/auth/refresh` chains and rotation invalidates one.
    if (started.current) return;
    started.current = true;

    apiClient.setUnauthorizedHandler(async () => {
      try {
        const session = await refreshSession();
        useAuthStore.setState({ user: session.user, status: 'authenticated', error: null });
        return true;
      } catch {
        // The refresh token is gone or was already used — the session is over.
        resetAuthState();
        return false;
      }
    });

    void bootstrap();
  }, [bootstrap]);

  return <>{children}</>;
}
