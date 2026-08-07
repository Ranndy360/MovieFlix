import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import type { MovieGenre, MovieListQuery, MovieSortBy, SortDirection } from '@/types/api';

export const DEFAULT_PAGE_SIZE = 12;

export interface MovieFiltersState {
  search: string;
  genre: MovieGenre | null;
  sortBy: MovieSortBy;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

export interface MovieFiltersActions {
  setSearch: (search: string) => void;
  setGenre: (genre: MovieGenre | null) => void;
  setSort: (sortBy: MovieSortBy, sortDirection: SortDirection) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

const INITIAL_STATE: MovieFiltersState = {
  search: '',
  genre: null,
  sortBy: 'createdAt',
  sortDirection: 'DESC',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

/**
 * Client-only UI state: what the user has typed and picked.
 *
 * Deliberately holds **no server data** — no movie list, no loading flag, no
 * error. Caching server responses in a global store is how you end up with two
 * sources of truth that drift; fetching stays in the component/hook that needs
 * it, keyed off these filters.
 */
export const useMovieFiltersStore = create<MovieFiltersState & MovieFiltersActions>()(
  devtools(
    (set) => ({
      ...INITIAL_STATE,

      // Changing a filter resets pagination: staying on page 7 of a new result
      // set almost always shows an empty screen.
      setSearch: (search) => set({ search, page: 1 }, false, 'setSearch'),
      setGenre: (genre) => set({ genre, page: 1 }, false, 'setGenre'),
      setSort: (sortBy, sortDirection) => set({ sortBy, sortDirection, page: 1 }, false, 'setSort'),
      setPage: (page) => set({ page: Math.max(1, page) }, false, 'setPage'),
      reset: () => set(INITIAL_STATE, false, 'reset'),
    }),
    { name: 'movie-filters', enabled: process.env.NODE_ENV === 'development' },
  ),
);

/**
 * Maps the store into the query object the API expects.
 *
 * `isPublished: true` is pinned, not a user filter. The API would happily show
 * an ADMIN every draft and a PROVIDER their own — correct for the management
 * screen, wrong for the catalog, where everyone should see the same shelf the
 * audience sees. Unpublished titles are managed from `/admin/movies`.
 */
export const toMovieListQuery = (state: MovieFiltersState): MovieListQuery => ({
  page: state.page,
  pageSize: state.pageSize,
  search: state.search.trim() || undefined,
  genre: state.genre ?? undefined,
  sortBy: state.sortBy,
  sortDirection: state.sortDirection,
  isPublished: true,
});

/**
 * Selector hook for the filter values only.
 *
 * `useShallow` matters: without it this returns a fresh object every render and
 * re-renders every subscriber on any store change.
 */
export const useMovieFilters = (): MovieFiltersState =>
  useMovieFiltersStore(
    useShallow((state) => ({
      search: state.search,
      genre: state.genre,
      sortBy: state.sortBy,
      sortDirection: state.sortDirection,
      page: state.page,
      pageSize: state.pageSize,
    })),
  );

/** Actions are stable references, so this never causes a re-render. */
export const useMovieFilterActions = (): MovieFiltersActions =>
  useMovieFiltersStore(
    useShallow((state) => ({
      setSearch: state.setSearch,
      setGenre: state.setGenre,
      setSort: state.setSort,
      setPage: state.setPage,
      reset: state.reset,
    })),
  );
