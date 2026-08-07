import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAuthStore } from '@/store/auth.store';
import { useWatchlistStore } from '@/store/watchlist.store';
import * as watchlistApi from '@/features/watchlist/api/watchlist.api';
import { buildUser } from '@/testing/factories/auth.factory';
import { WatchlistControls } from './watchlist-controls';

jest.mock('@/features/watchlist/api/watchlist.api');

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const api = watchlistApi as jest.Mocked<typeof watchlistApi>;
const MOVIE = 'movie-1';

const signIn = (): void => {
  useAuthStore.setState({ user: buildUser(), status: 'authenticated', error: null });
};

describe('WatchlistControls', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'unauthenticated', error: null });
    useWatchlistStore.setState({ byMovieId: {}, isLoaded: true, pending: {}, error: null });
  });

  describe('anonymous', () => {
    it('offers sign-in rather than a control that would 401', async () => {
      const user = userEvent.setup();
      render(<WatchlistControls movieId={MOVIE} />);

      await user.click(screen.getByRole('button', { name: /My List/ }));

      expect(push).toHaveBeenCalledWith(expect.stringContaining('/login'));
      expect(api.addToWatchlist).not.toHaveBeenCalled();
    });
  });

  describe('compact variant', () => {
    it('adds the movie as WANT', async () => {
      signIn();
      const user = userEvent.setup();
      api.addToWatchlist.mockResolvedValue({} as never);

      render(<WatchlistControls movieId={MOVIE} />);
      await user.click(screen.getByRole('button', { name: 'Add to my list' }));

      await waitFor(() => expect(api.addToWatchlist).toHaveBeenCalledWith(MOVIE, 'WANT'));
    });

    it('reflects membership with aria-pressed', () => {
      signIn();
      useWatchlistStore.setState({ byMovieId: { [MOVIE]: 'WANT' } });

      render(<WatchlistControls movieId={MOVIE} />);

      expect(screen.getByRole('button', { name: 'Remove from my list' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('removes a movie that is already on the list', async () => {
      signIn();
      useWatchlistStore.setState({ byMovieId: { [MOVIE]: 'WATCHED' } });
      const user = userEvent.setup();
      api.removeFromWatchlist.mockResolvedValue(undefined);

      render(<WatchlistControls movieId={MOVIE} />);
      await user.click(screen.getByRole('button', { name: 'Remove from my list' }));

      await waitFor(() => expect(api.removeFromWatchlist).toHaveBeenCalledWith(MOVIE));
    });

    it('disables itself while a mutation is in flight', () => {
      signIn();
      useWatchlistStore.setState({ pending: { [MOVIE]: true } });

      render(<WatchlistControls movieId={MOVIE} />);

      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('full variant', () => {
    it('exposes all three statuses as a labelled group', () => {
      signIn();
      render(<WatchlistControls movieId={MOVIE} variant="full" />);

      expect(screen.getByRole('group', { name: 'Watchlist status' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Want to watch' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Watching' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Watched' })).toBeInTheDocument();
    });

    it('sets the chosen status', async () => {
      signIn();
      const user = userEvent.setup();
      api.addToWatchlist.mockResolvedValue({} as never);

      render(<WatchlistControls movieId={MOVIE} variant="full" />);
      await user.click(screen.getByRole('button', { name: 'Watched' }));

      await waitFor(() => expect(api.addToWatchlist).toHaveBeenCalledWith(MOVIE, 'WATCHED'));
    });

    it('marks the active status with aria-pressed', () => {
      signIn();
      useWatchlistStore.setState({ byMovieId: { [MOVIE]: 'WATCHING' } });

      render(<WatchlistControls movieId={MOVIE} variant="full" />);

      expect(screen.getByRole('button', { name: 'Watching' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Watched' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('clicking the active status removes the entry (toggle off)', async () => {
      signIn();
      useWatchlistStore.setState({ byMovieId: { [MOVIE]: 'WANT' } });
      const user = userEvent.setup();
      api.removeFromWatchlist.mockResolvedValue(undefined);

      render(<WatchlistControls movieId={MOVIE} variant="full" />);
      await user.click(screen.getByRole('button', { name: 'Want to watch' }));

      await waitFor(() => expect(api.removeFromWatchlist).toHaveBeenCalledWith(MOVIE));
    });

    it('explains the review precondition', () => {
      signIn();
      render(<WatchlistControls movieId={MOVIE} variant="full" />);

      expect(screen.getByText(/Mark a movie as watched to review it/)).toBeInTheDocument();
    });

    it('confirms reviewing is unlocked once watched', () => {
      signIn();
      useWatchlistStore.setState({ byMovieId: { [MOVIE]: 'WATCHED' } });

      render(<WatchlistControls movieId={MOVIE} variant="full" />);

      expect(screen.getByText(/you can leave a review below/)).toBeInTheDocument();
    });
  });
});
