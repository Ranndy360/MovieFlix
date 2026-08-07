import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import * as watchlistApi from '@/features/watchlist/api/watchlist.api';
import type { WatchlistStatus } from '@/types/api';

export interface WatchlistIndexState {
  /** movieId → status, for the movies on the caller's list. */
  byMovieId: Record<string, WatchlistStatus>;
  isLoaded: boolean;
  /** movieIds with a mutation in flight, so buttons can disable individually. */
  pending: Record<string, true>;
  error: string | null;
}

export interface WatchlistIndexActions {
  load: () => Promise<void>;
  setStatus: (movieId: string, status: WatchlistStatus) => Promise<void>;
  remove: (movieId: string) => Promise<void>;
  clear: () => void;
}

const INITIAL_STATE: WatchlistIndexState = {
  byMovieId: {},
  isLoaded: false,
  pending: {},
  error: null,
};

const withPending = (
  pending: Record<string, true>,
  movieId: string,
  active: boolean,
): Record<string, true> => {
  const next = { ...pending };
  if (active) next[movieId] = true;
  else delete next[movieId];
  return next;
};

/**
 * A client-side **index** of which movies are on the caller's list.
 *
 * This is a deliberate exception to "no server data in Zustand". Every poster
 * tile, row and hero button needs to know its own status, and the alternatives
 * are worse: one request per card (dozens of round trips), or prop-drilling the
 * list through the entire tree. So the whole list is fetched once per session
 * and kept in sync by the same mutations that change it.
 *
 * It stays honest because it is small, scoped to one user, never rendered as
 * the source of truth for content (only for button state), and cleared on
 * sign-out. Mutations are optimistic and roll back on failure.
 */
export const useWatchlistStore = create<WatchlistIndexState & WatchlistIndexActions>()(
  devtools(
    (set, get) => ({
      ...INITIAL_STATE,

      async load() {
        try {
          // One page large enough for a personal list; the full list view
          // paginates properly on its own.
          const page = await watchlistApi.listWatchlist({ pageSize: 100 });

          const byMovieId: Record<string, WatchlistStatus> = {};
          for (const entry of page.items) {
            byMovieId[entry.movieId] = entry.status;
          }

          set({ byMovieId, isLoaded: true, error: null }, false, 'watchlist:loaded');
        } catch {
          // Anonymous visitors 401 here; that is not an error worth surfacing.
          set({ ...INITIAL_STATE, isLoaded: true }, false, 'watchlist:unavailable');
        }
      },

      async setStatus(movieId, status) {
        const previous = get().byMovieId[movieId];

        set(
          (state) => ({
            byMovieId: { ...state.byMovieId, [movieId]: status },
            pending: withPending(state.pending, movieId, true),
            error: null,
          }),
          false,
          'watchlist:setStatus',
        );

        try {
          // Already on the list → PATCH; otherwise POST to create it.
          if (previous) await watchlistApi.updateWatchlistStatus(movieId, status);
          else await watchlistApi.addToWatchlist(movieId, status);

          set(
            (state) => ({ pending: withPending(state.pending, movieId, false) }),
            false,
            'watchlist:setStatus:done',
          );
        } catch {
          set(
            (state) => {
              const byMovieId = { ...state.byMovieId };
              if (previous) byMovieId[movieId] = previous;
              else delete byMovieId[movieId];

              return {
                byMovieId,
                pending: withPending(state.pending, movieId, false),
                error: 'Could not update your list. Please try again.',
              };
            },
            false,
            'watchlist:setStatus:rollback',
          );
        }
      },

      async remove(movieId) {
        const previous = get().byMovieId[movieId];

        set(
          (state) => {
            const byMovieId = { ...state.byMovieId };
            delete byMovieId[movieId];
            return {
              byMovieId,
              pending: withPending(state.pending, movieId, true),
              error: null,
            };
          },
          false,
          'watchlist:remove',
        );

        try {
          await watchlistApi.removeFromWatchlist(movieId);
          set(
            (state) => ({ pending: withPending(state.pending, movieId, false) }),
            false,
            'watchlist:remove:done',
          );
        } catch {
          set(
            (state) => ({
              byMovieId: previous
                ? { ...state.byMovieId, [movieId]: previous }
                : state.byMovieId,
              pending: withPending(state.pending, movieId, false),
              error: 'Could not update your list. Please try again.',
            }),
            false,
            'watchlist:remove:rollback',
          );
        }
      },

      clear() {
        set(INITIAL_STATE, false, 'watchlist:clear');
      },
    }),
    { name: 'watchlist', enabled: process.env.NODE_ENV === 'development' },
  ),
);

/** Status of one movie, or `undefined` when it is not on the list. */
export const useWatchlistStatus = (movieId: string): WatchlistStatus | undefined =>
  useWatchlistStore((state) => state.byMovieId[movieId]);

export const useIsWatchlistPending = (movieId: string): boolean =>
  useWatchlistStore((state) => state.pending[movieId] === true);

export const useWatchlistActions = (): WatchlistIndexActions =>
  useWatchlistStore(
    useShallow((state) => ({
      load: state.load,
      setStatus: state.setStatus,
      remove: state.remove,
      clear: state.clear,
    })),
  );
