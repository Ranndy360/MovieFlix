import { act, renderHook } from '@testing-library/react';

import {
  DEFAULT_PAGE_SIZE,
  toMovieListQuery,
  useMovieFilterActions,
  useMovieFilters,
  useMovieFiltersStore,
} from './movie-filters.store';

describe('useMovieFiltersStore', () => {
  beforeEach(() => {
    useMovieFiltersStore.getState().reset();
  });

  it('starts with sane defaults', () => {
    expect(useMovieFiltersStore.getState()).toMatchObject({
      search: '',
      genre: null,
      sortBy: 'createdAt',
      sortDirection: 'DESC',
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it('resets to page 1 when the search changes', () => {
    useMovieFiltersStore.getState().setPage(5);
    useMovieFiltersStore.getState().setSearch('dune');

    expect(useMovieFiltersStore.getState()).toMatchObject({ search: 'dune', page: 1 });
  });

  it('resets to page 1 when the genre changes', () => {
    useMovieFiltersStore.getState().setPage(4);
    useMovieFiltersStore.getState().setGenre('HORROR');

    expect(useMovieFiltersStore.getState()).toMatchObject({ genre: 'HORROR', page: 1 });
  });

  it('resets to page 1 when the sort changes', () => {
    useMovieFiltersStore.getState().setPage(3);
    useMovieFiltersStore.getState().setSort('rating', 'ASC');

    expect(useMovieFiltersStore.getState()).toMatchObject({
      sortBy: 'rating',
      sortDirection: 'ASC',
      page: 1,
    });
  });

  it('clamps the page to a minimum of 1', () => {
    useMovieFiltersStore.getState().setPage(-3);

    expect(useMovieFiltersStore.getState().page).toBe(1);
  });

  it('restores every default on reset', () => {
    const state = useMovieFiltersStore.getState();
    state.setSearch('x');
    state.setGenre('COMEDY');
    state.setPage(9);

    useMovieFiltersStore.getState().reset();

    expect(useMovieFiltersStore.getState()).toMatchObject({
      search: '',
      genre: null,
      page: 1,
    });
  });
});

describe('toMovieListQuery', () => {
  // The store is a module singleton, so each case must start clean.
  beforeEach(() => {
    useMovieFiltersStore.getState().reset();
  });

  it('maps the store state onto the API query', () => {
    expect(toMovieListQuery(useMovieFiltersStore.getState())).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      search: undefined,
      genre: undefined,
      sortBy: 'createdAt',
      sortDirection: 'DESC',
      isPublished: true,
    });
  });

  it('trims the search term and drops it when blank', () => {
    useMovieFiltersStore.getState().setSearch('   ');
    expect(toMovieListQuery(useMovieFiltersStore.getState()).search).toBeUndefined();

    useMovieFiltersStore.getState().setSearch('  dune  ');
    expect(toMovieListQuery(useMovieFiltersStore.getState()).search).toBe('dune');
  });

  it('always asks for published titles only', () => {
    // An admin browsing the catalog must see the same shelf as everyone else;
    // their drafts belong on the management screen.
    expect(toMovieListQuery(useMovieFiltersStore.getState()).isPublished).toBe(true);

    useMovieFiltersStore.getState().setSearch('dune');
    useMovieFiltersStore.getState().setGenre('HORROR');
    expect(toMovieListQuery(useMovieFiltersStore.getState()).isPublished).toBe(true);
  });

  it('converts a null genre to undefined so it is omitted from the query', () => {
    expect(toMovieListQuery(useMovieFiltersStore.getState()).genre).toBeUndefined();
  });
});

describe('selector hooks', () => {
  it('exposes the current filter values', () => {
    const { result } = renderHook(() => useMovieFilters());

    act(() => useMovieFiltersStore.getState().setSearch('arrival'));

    expect(result.current.search).toBe('arrival');
  });

  it('returns stable action references across renders', () => {
    const { result, rerender } = renderHook(() => useMovieFilterActions());
    const first = result.current.setSearch;

    rerender();

    expect(result.current.setSearch).toBe(first);
  });
});
