import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as authApi from '@/features/auth/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { useWatchlistStore } from '@/store/watchlist.store';
import { buildAdmin, buildUser } from '@/testing/factories/auth.factory';
import { SiteHeader } from './site-header';

jest.mock('@/features/auth/api/auth.api');
jest.mock('next/navigation', () => ({
  usePathname: () => '/movies',
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
}));

const api = authApi as jest.Mocked<typeof authApi>;
const realLocation = window.location;

function stubLocation(): { assign: jest.Mock; replace: jest.Mock } {
  const stub = { pathname: '/movies', assign: jest.fn(), replace: jest.fn() };
  Object.defineProperty(window, 'location', { value: stub, writable: true, configurable: true });
  return stub;
}

describe('SiteHeader', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: buildUser(), status: 'authenticated', error: null });
    useWatchlistStore.setState({ byMovieId: { 'movie-1': 'WATCHED' }, isLoaded: true });
    api.logout.mockResolvedValue({ message: 'ok' });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: realLocation,
      writable: true,
      configurable: true,
    });
  });

  it('hides the admin links from a plain user', () => {
    stubLocation();

    render(<SiteHeader />);

    expect(screen.queryByRole('link', { name: 'Manage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('shows them to an admin', () => {
    useAuthStore.setState({ user: buildAdmin(), status: 'authenticated', error: null });
    stubLocation();

    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Manage' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
  });

  describe('signing out', () => {
    it('tells the API first', async () => {
      const user = userEvent.setup();
      stubLocation();

      render(<SiteHeader />);
      await user.click(screen.getByRole('button', { name: 'Sign out' }));

      await waitFor(() => expect(api.logout).toHaveBeenCalled());
    });

    /**
     * The regression: `router.replace` + `router.refresh` raced the redirect
     * that `useRequireAuth` fires the instant the store goes unauthenticated.
     * When they cancelled each other the user stayed on a protected page that
     * renders only its "checking your session" skeleton, with no effect left
     * to re-run. A document navigation cannot be cancelled that way.
     */
    it('leaves with a full page load', async () => {
      const user = userEvent.setup();
      const location = stubLocation();

      render(<SiteHeader />);
      await user.click(screen.getByRole('button', { name: 'Sign out' }));

      await waitFor(() => expect(location.assign).toHaveBeenCalledWith('/login'));
    });

    it('clears the session and the previous user list', async () => {
      const user = userEvent.setup();
      stubLocation();

      render(<SiteHeader />);
      await user.click(screen.getByRole('button', { name: 'Sign out' }));

      await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
      expect(useAuthStore.getState().status).toBe('unauthenticated');
      // Otherwise the next person to sign in on this machine inherits the badges.
      expect(useWatchlistStore.getState().byMovieId).toEqual({});
    });

    it('still signs out locally when the request fails', async () => {
      const user = userEvent.setup();
      const location = stubLocation();
      api.logout.mockRejectedValue(new Error('offline'));

      render(<SiteHeader />);
      await user.click(screen.getByRole('button', { name: 'Sign out' }));

      // A dead request must not trap the user in a session they have left.
      await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
      expect(location.assign).toHaveBeenCalledWith('/login');
    });
  });
});
