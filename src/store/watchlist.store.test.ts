import * as watchlistApi from '@/features/watchlist/api/watchlist.api';
import { useWatchlistStore } from './watchlist.store';

jest.mock('@/features/watchlist/api/watchlist.api');

const api = watchlistApi as jest.Mocked<typeof watchlistApi>;

const MOVIE = 'movie-1';

const page = (items: { movieId: string; status: 'WANT' | 'WATCHING' | 'WATCHED' }[]) =>
  ({
    items: items.map((item, index) => ({
      id: `entry-${index}`,
      movieId: item.movieId,
      status: item.status,
      watchedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })),
    meta: {
      page: 1,
      pageSize: 100,
      totalItems: items.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  }) as Awaited<ReturnType<typeof watchlistApi.listWatchlist>>;

describe('useWatchlistStore', () => {
  beforeEach(() => {
    useWatchlistStore.setState({ byMovieId: {}, isLoaded: false, pending: {}, error: null });
  });

  describe('load', () => {
    it('indexes the list by movieId', async () => {
      api.listWatchlist.mockResolvedValue(page([{ movieId: MOVIE, status: 'WATCHED' }]));

      await useWatchlistStore.getState().load();

      expect(useWatchlistStore.getState().byMovieId).toEqual({ [MOVIE]: 'WATCHED' });
      expect(useWatchlistStore.getState().isLoaded).toBe(true);
    });

    it('treats a 401 as an empty list, not an error', async () => {
      api.listWatchlist.mockRejectedValue(new Error('unauthorized'));

      await useWatchlistStore.getState().load();

      expect(useWatchlistStore.getState()).toMatchObject({
        byMovieId: {},
        isLoaded: true,
        error: null,
      });
    });
  });

  describe('setStatus', () => {
    it('POSTs for a movie that is not yet on the list', async () => {
      api.addToWatchlist.mockResolvedValue({} as never);

      await useWatchlistStore.getState().setStatus(MOVIE, 'WANT');

      expect(api.addToWatchlist).toHaveBeenCalledWith(MOVIE, 'WANT');
      expect(api.updateWatchlistStatus).not.toHaveBeenCalled();
    });

    it('PATCHes a movie that is already on the list', async () => {
      useWatchlistStore.setState({ byMovieId: { [MOVIE]: 'WANT' } });
      api.updateWatchlistStatus.mockResolvedValue({} as never);

      await useWatchlistStore.getState().setStatus(MOVIE, 'WATCHED');

      expect(api.updateWatchlistStatus).toHaveBeenCalledWith(MOVIE, 'WATCHED');
      expect(api.addToWatchlist).not.toHaveBeenCalled();
    });

    it('applies the change optimistically before the request settles', async () => {
      let resolve: (() => void) | undefined;
      api.addToWatchlist.mockReturnValue(
        new Promise((r) => {
          resolve = () => r({} as never);
        }),
      );

      const promise = useWatchlistStore.getState().setStatus(MOVIE, 'WANT');

      // The badge must appear immediately — that is the point of optimism.
      expect(useWatchlistStore.getState().byMovieId[MOVIE]).toBe('WANT');
      expect(useWatchlistStore.getState().pending[MOVIE]).toBe(true);

      resolve?.();
      await promise;

      expect(useWatchlistStore.getState().pending[MOVIE]).toBeUndefined();
    });

    it('rolls back to "not on the list" when the create fails', async () => {
      api.addToWatchlist.mockRejectedValue(new Error('offline'));

      await useWatchlistStore.getState().setStatus(MOVIE, 'WANT');

      expect(useWatchlistStore.getState().byMovieId[MOVIE]).toBeUndefined();
      expect(useWatchlistStore.getState().error).toMatch(/could not update/i);
    });

    it('rolls back to the previous status when the update fails', async () => {
      useWatchlistStore.setState({ byMovieId: { [MOVIE]: 'WANT' } });
      api.updateWatchlistStatus.mockRejectedValue(new Error('offline'));

      await useWatchlistStore.getState().setStatus(MOVIE, 'WATCHED');

      expect(useWatchlistStore.getState().byMovieId[MOVIE]).toBe('WANT');
    });

    it('clears the pending flag even after a failure', async () => {
      api.addToWatchlist.mockRejectedValue(new Error('offline'));

      await useWatchlistStore.getState().setStatus(MOVIE, 'WANT');

      expect(useWatchlistStore.getState().pending[MOVIE]).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('drops the entry optimistically', async () => {
      useWatchlistStore.setState({ byMovieId: { [MOVIE]: 'WATCHED' } });
      api.removeFromWatchlist.mockResolvedValue(undefined);

      await useWatchlistStore.getState().remove(MOVIE);

      expect(useWatchlistStore.getState().byMovieId[MOVIE]).toBeUndefined();
      expect(api.removeFromWatchlist).toHaveBeenCalledWith(MOVIE);
    });

    it('restores the entry when the delete fails', async () => {
      useWatchlistStore.setState({ byMovieId: { [MOVIE]: 'WATCHING' } });
      api.removeFromWatchlist.mockRejectedValue(new Error('offline'));

      await useWatchlistStore.getState().remove(MOVIE);

      expect(useWatchlistStore.getState().byMovieId[MOVIE]).toBe('WATCHING');
      expect(useWatchlistStore.getState().error).toMatch(/could not update/i);
    });
  });

  it('clears everything on sign-out', () => {
    useWatchlistStore.setState({ byMovieId: { [MOVIE]: 'WANT' }, isLoaded: true });

    useWatchlistStore.getState().clear();

    // Leaking one user's list into the next session would be a privacy bug.
    expect(useWatchlistStore.getState()).toMatchObject({ byMovieId: {}, isLoaded: false });
  });
});
