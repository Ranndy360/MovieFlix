import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import { isApiError } from '@/lib/api';
import * as authApi from '@/features/auth/api/auth.api';
import type { AuthUser, LoginPayload, RegisterPayload, Role } from '@/types/auth';

export type AuthStatus =
  /** Before the first `/auth/me` resolves — render nothing role-dependent yet. */
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'unauthenticated';

export interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
}

export interface AuthActions {
  bootstrap: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<boolean>;
  register: (payload: RegisterPayload) => Promise<boolean>;
  logout: () => Promise<void>;
  logoutEverywhere: () => Promise<void>;
  clearError: () => void;
}

const INITIAL_STATE: AuthState = {
  user: null,
  status: 'idle',
  error: null,
};

const messageFor = (error: unknown, fallback: string): string =>
  isApiError(error) ? error.toDisplayMessage() : fallback;

/**
 * Holds only the *profile* — never a token.
 *
 * Tokens live in `httpOnly` cookies the browser manages, so the store's job is
 * simply to answer "who is signed in, and are we still finding out?".
 * `status` exists so the UI can distinguish "not logged in" from "not known
 * yet"; conflating them makes protected pages flash their signed-out state on
 * every reload.
 *
 * Not persisted: rehydrating a stale user from `localStorage` would let the UI
 * claim a session the cookies no longer back. `bootstrap()` is the only
 * source of truth, and it asks the server.
 */
export const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    (set) => ({
      ...INITIAL_STATE,

      async bootstrap() {
        set({ status: 'loading', error: null }, false, 'bootstrap:start');

        try {
          const user = await authApi.getCurrentUser();
          set({ user, status: 'authenticated', error: null }, false, 'bootstrap:authenticated');
        } catch {
          // A 401 here is the ordinary "no session" case, not an error worth
          // showing anyone.
          set({ user: null, status: 'unauthenticated', error: null }, false, 'bootstrap:anonymous');
        }
      },

      async login(payload) {
        set({ status: 'loading', error: null }, false, 'login:start');

        try {
          const session = await authApi.login(payload);
          set({ user: session.user, status: 'authenticated', error: null }, false, 'login:success');
          return true;
        } catch (error) {
          set(
            {
              user: null,
              status: 'unauthenticated',
              error: messageFor(error, 'Unable to sign in. Please try again.'),
            },
            false,
            'login:failure',
          );
          return false;
        }
      },

      async register(payload) {
        set({ status: 'loading', error: null }, false, 'register:start');

        try {
          const session = await authApi.register(payload);
          set(
            { user: session.user, status: 'authenticated', error: null },
            false,
            'register:success',
          );
          return true;
        } catch (error) {
          set(
            {
              user: null,
              status: 'unauthenticated',
              error: messageFor(error, 'Unable to create the account. Please try again.'),
            },
            false,
            'register:failure',
          );
          return false;
        }
      },

      /**
       * Never rejects. Signing out is something the user asked for, not an
       * operation that can "fail" from their point of view — if the request
       * dies, the local session is still cleared and the caller can still
       * navigate away.
       */
      async logout() {
        try {
          await authApi.logout();
        } catch {
          // Swallowed deliberately: the cookies may survive, but leaving the
          // UI "signed in" is strictly worse than a stale cookie the API will
          // reject anyway.
        } finally {
          set({ user: null, status: 'unauthenticated', error: null }, false, 'logout');
        }
      },

      async logoutEverywhere() {
        try {
          await authApi.logoutEverywhere();
        } catch {
          // Same reasoning as `logout`.
        } finally {
          set({ user: null, status: 'unauthenticated', error: null }, false, 'logoutEverywhere');
        }
      },

      clearError() {
        set({ error: null }, false, 'clearError');
      },
    }),
    { name: 'auth', enabled: process.env.NODE_ENV === 'development' },
  ),
);

/* ---------------- selectors ---------------- */

export const useAuthUser = (): AuthUser | null => useAuthStore((state) => state.user);

export const useAuthStatus = (): AuthStatus => useAuthStore((state) => state.status);

export const useIsAuthenticated = (): boolean =>
  useAuthStore((state) => state.status === 'authenticated');

/** True only once we actually know — prevents a signed-out flash on reload. */
export const useIsAuthResolved = (): boolean =>
  useAuthStore((state) => state.status === 'authenticated' || state.status === 'unauthenticated');

export const useAuthError = (): string | null => useAuthStore((state) => state.error);

/**
 * Client-side role check. Convenience for rendering, never a security
 * boundary — the API re-checks every request against the database.
 */
export const useHasRole = (...roles: Role[]): boolean =>
  useAuthStore((state) => state.user !== null && roles.includes(state.user.role));

export const useAuthActions = (): AuthActions =>
  useAuthStore(
    useShallow((state) => ({
      bootstrap: state.bootstrap,
      login: state.login,
      register: state.register,
      logout: state.logout,
      logoutEverywhere: state.logoutEverywhere,
      clearError: state.clearError,
    })),
  );

/** Plain helper for non-React callers (e.g. the HTTP client's 401 handler). */
export const resetAuthState = (): void =>
  useAuthStore.setState({ user: null, status: 'unauthenticated', error: null });
