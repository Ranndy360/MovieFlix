import { act, renderHook } from '@testing-library/react';

import { ApiError } from '@/lib/api';
import * as authApi from '@/features/auth/api/auth.api';
import { buildAdmin, buildSession, buildUser } from '@/testing/factories/auth.factory';
import {
  useAuthStore,
  useHasRole,
  useIsAuthResolved,
  resetAuthState,
} from './auth.store';

jest.mock('@/features/auth/api/auth.api');

const api = authApi as jest.Mocked<typeof authApi>;

const unauthorized = (): ApiError =>
  new ApiError({ message: 'Authentication required', status: 401, kind: 'client', url: '/auth/me' });

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'idle', error: null });
  });

  it('starts idle so the UI can tell "unknown" from "signed out"', () => {
    expect(useAuthStore.getState()).toMatchObject({ user: null, status: 'idle', error: null });
  });

  describe('bootstrap', () => {
    it('authenticates when a valid session cookie exists', async () => {
      const user = buildUser();
      api.getCurrentUser.mockResolvedValue(user);

      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState()).toMatchObject({ user, status: 'authenticated' });
    });

    it('treats a 401 as ordinary anonymity, not an error', async () => {
      api.getCurrentUser.mockRejectedValue(unauthorized());

      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState()).toMatchObject({
        user: null,
        status: 'unauthenticated',
        error: null,
      });
    });
  });

  describe('login', () => {
    it('stores the returned profile', async () => {
      const session = buildSession(buildAdmin());
      api.login.mockResolvedValue(session);

      await expect(
        useAuthStore.getState().login({ email: 'a@b.io', password: 'x' }),
      ).resolves.toBe(true);
      expect(useAuthStore.getState().user).toEqual(session.user);
    });

    it('never stores a token — there is none to store', async () => {
      api.login.mockResolvedValue(buildSession());

      await useAuthStore.getState().login({ email: 'a@b.io', password: 'x' });

      const serialized = JSON.stringify(useAuthStore.getState());
      expect(serialized).not.toContain('token');
      expect(serialized).not.toContain('password');
    });

    it('surfaces the server message on failure', async () => {
      api.login.mockRejectedValue(
        new ApiError({
          message: 'Invalid email or password',
          status: 401,
          kind: 'client',
          url: '/auth/login',
        }),
      );

      await expect(
        useAuthStore.getState().login({ email: 'a@b.io', password: 'wrong' }),
      ).resolves.toBe(false);
      expect(useAuthStore.getState()).toMatchObject({
        user: null,
        status: 'unauthenticated',
        error: 'Invalid email or password',
      });
    });

    it('shows the lockout message from a 429', async () => {
      api.login.mockRejectedValue(
        new ApiError({
          message: 'Too many failed attempts. Try again in 15 minute(s).',
          status: 429,
          kind: 'client',
          url: '/auth/login',
        }),
      );

      await useAuthStore.getState().login({ email: 'a@b.io', password: 'x' });

      expect(useAuthStore.getState().error).toMatch(/15 minute/);
    });

    it('falls back to a generic message for a non-ApiError', async () => {
      api.login.mockRejectedValue(new Error('boom'));

      await useAuthStore.getState().login({ email: 'a@b.io', password: 'x' });

      expect(useAuthStore.getState().error).toBe('Unable to sign in. Please try again.');
    });
  });

  describe('register', () => {
    it('signs the new account straight in', async () => {
      const session = buildSession(buildUser('USER'));
      api.register.mockResolvedValue(session);

      await expect(
        useAuthStore.getState().register({
          email: 'a@b.io',
          password: 'Str0ng!Passw0rd',
          firstName: 'A',
          lastName: 'B',
        }),
      ).resolves.toBe(true);
      expect(useAuthStore.getState().user?.role).toBe('USER');
    });

    it('reports a duplicate email', async () => {
      api.register.mockRejectedValue(
        new ApiError({
          message: 'An account with this email already exists',
          status: 409,
          kind: 'client',
          url: '/auth/register',
        }),
      );

      await expect(
        useAuthStore.getState().register({
          email: 'taken@b.io',
          password: 'Str0ng!Passw0rd',
          firstName: 'A',
          lastName: 'B',
        }),
      ).resolves.toBe(false);
      expect(useAuthStore.getState().error).toMatch(/already exists/);
    });
  });

  describe('logout', () => {
    it('clears the session', async () => {
      useAuthStore.setState({ user: buildUser(), status: 'authenticated', error: null });
      api.logout.mockResolvedValue({ message: 'Signed out' });

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState()).toMatchObject({ user: null, status: 'unauthenticated' });
    });

    it('clears locally even when the request fails', async () => {
      useAuthStore.setState({ user: buildUser(), status: 'authenticated', error: null });
      api.logout.mockRejectedValue(new Error('network down'));

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
    });

    it('signs out everywhere', async () => {
      useAuthStore.setState({ user: buildUser(), status: 'authenticated', error: null });
      api.logoutEverywhere.mockResolvedValue({ message: 'Signed out of 3 session(s)' });

      await useAuthStore.getState().logoutEverywhere();

      expect(api.logoutEverywhere).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  it('clears the error on demand', () => {
    useAuthStore.setState({ error: 'boom' });

    useAuthStore.getState().clearError();

    expect(useAuthStore.getState().error).toBeNull();
  });

  it('resetAuthState works outside React', () => {
    useAuthStore.setState({ user: buildUser(), status: 'authenticated', error: null });

    resetAuthState();

    expect(useAuthStore.getState()).toMatchObject({ user: null, status: 'unauthenticated' });
  });
});

describe('role selectors', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'idle', error: null });
  });

  it('matches the exact role', () => {
    act(() => useAuthStore.setState({ user: buildAdmin(), status: 'authenticated' }));

    expect(renderHook(() => useHasRole('ADMIN')).result.current).toBe(true);
  });

  it('treats several roles as OR', () => {
    act(() => useAuthStore.setState({ user: buildUser('PROVIDER'), status: 'authenticated' }));

    expect(renderHook(() => useHasRole('ADMIN', 'PROVIDER')).result.current).toBe(true);
  });

  it('rejects a role the user does not hold', () => {
    act(() => useAuthStore.setState({ user: buildUser('USER'), status: 'authenticated' }));

    expect(renderHook(() => useHasRole('ADMIN')).result.current).toBe(false);
  });

  it('is false when nobody is signed in', () => {
    expect(renderHook(() => useHasRole('USER')).result.current).toBe(false);
  });

  it('reports the session as unresolved while idle or loading', () => {
    expect(renderHook(() => useIsAuthResolved()).result.current).toBe(false);

    act(() => useAuthStore.setState({ status: 'loading' }));
    expect(renderHook(() => useIsAuthResolved()).result.current).toBe(false);

    act(() => useAuthStore.setState({ status: 'unauthenticated' }));
    expect(renderHook(() => useIsAuthResolved()).result.current).toBe(true);
  });
});
