import { renderHook, waitFor } from '@testing-library/react';

import { useAuthStore } from '@/store/auth.store';
import { buildAdmin, buildUser } from '@/testing/factories/auth.factory';
import { useRequireAuth } from './use-require-auth';

const replace = jest.fn();
const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
}));

/** jsdom refuses to navigate for real, so `location` is swapped for a double. */
function stubLocation(pathname = '/profile'): { replace: jest.Mock; assign: jest.Mock } {
  const stub = { pathname, replace: jest.fn(), assign: jest.fn(), href: `http://localhost${pathname}` };
  Object.defineProperty(window, 'location', { value: stub, writable: true, configurable: true });
  return stub;
}

const realLocation = window.location;

describe('useRequireAuth', () => {
  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: realLocation,
      writable: true,
      configurable: true,
    });
  });

  it('waits while the session is still resolving', () => {
    useAuthStore.setState({ user: null, status: 'loading', error: null });
    const location = stubLocation();

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isPending).toBe(true);
    expect(result.current.isAllowed).toBe(false);
    // Redirecting here would boot a signed-in user mid-bootstrap.
    expect(location.replace).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('allows a signed-in user through', () => {
    useAuthStore.setState({ user: buildUser(), status: 'authenticated', error: null });
    const location = stubLocation();

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isAllowed).toBe(true);
    expect(location.replace).not.toHaveBeenCalled();
  });

  describe('when the session has ended', () => {
    /**
     * The regression this guards: callers render a skeleton while `isAllowed`
     * is false and have no other exit. A client-side `router.replace` can be
     * cancelled by a competing navigation, and because the effect's deps do not
     * change afterwards, nothing retries — the page sits on that skeleton
     * forever. A document-level navigation cannot be cancelled that way.
     */
    it('leaves with a real navigation, not the client router', async () => {
      useAuthStore.setState({ user: null, status: 'unauthenticated', error: null });
      const location = stubLocation('/profile');

      renderHook(() => useRequireAuth());

      await waitFor(() => expect(location.replace).toHaveBeenCalledWith('/login?next=%2Fprofile'));
      expect(replace).not.toHaveBeenCalled();
    });

    it('replaces rather than pushes, so Back does not bounce through', async () => {
      useAuthStore.setState({ user: null, status: 'unauthenticated', error: null });
      const location = stubLocation('/my-list');

      renderHook(() => useRequireAuth());

      await waitFor(() => expect(location.replace).toHaveBeenCalled());
      expect(location.assign).not.toHaveBeenCalled();
    });

    it('honours a custom destination', async () => {
      useAuthStore.setState({ user: null, status: 'unauthenticated', error: null });
      const location = stubLocation('/admin/users');

      renderHook(() => useRequireAuth(undefined, '/goodbye'));

      await waitFor(() =>
        expect(location.replace).toHaveBeenCalledWith('/goodbye?next=%2Fadmin%2Fusers'),
      );
    });
  });

  describe('roles', () => {
    it('lets a matching role through', () => {
      useAuthStore.setState({ user: buildAdmin(), status: 'authenticated', error: null });
      stubLocation();

      const { result } = renderHook(() => useRequireAuth(['ADMIN']));

      expect(result.current.isAllowed).toBe(true);
    });

    it('sends a signed-in user with the wrong role to /forbidden', async () => {
      useAuthStore.setState({ user: buildUser(), status: 'authenticated', error: null });
      const location = stubLocation();

      const { result } = renderHook(() => useRequireAuth(['ADMIN']));

      // Their session is fine, so this stays a client navigation — no reload.
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/forbidden'));
      expect(location.replace).not.toHaveBeenCalled();
      expect(result.current.isAllowed).toBe(false);
    });
  });
});
