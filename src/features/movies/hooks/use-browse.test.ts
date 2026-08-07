import { act, renderHook, waitFor } from '@testing-library/react';

import { ApiError } from '@/lib/api';
import { listMovies } from '@/features/movies/api/movies.api';
import { movieFactory } from '@/testing/factories/movie.factory';
import type { Movie, Paginated } from '@/types/api';
import { useBrowse } from './use-browse';

jest.mock('@/features/movies/api/movies.api');

const listMoviesMock = listMovies as jest.MockedFunction<typeof listMovies>;

const page = (items: Movie[]): Paginated<Movie> => ({
  items,
  meta: {
    page: 1,
    pageSize: 100,
    totalItems: items.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
});

describe('useBrowse', () => {
  it('fetches the catalog in a single request', async () => {
    listMoviesMock.mockResolvedValue(page(movieFactory.buildMany(3)));

    renderHook(() => useBrowse());

    // One round trip for the whole page, not one per genre row.
    await waitFor(() => expect(listMoviesMock).toHaveBeenCalledTimes(1));
    expect(listMoviesMock).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'rating', sortDirection: 'DESC', isPublished: true }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('features the first (highest-rated) movie', async () => {
    const movies = [
      movieFactory.build({ title: 'Best', rating: 9.3 }),
      movieFactory.build({ title: 'Second', rating: 8.1 }),
    ];
    listMoviesMock.mockResolvedValue(page(movies));

    const { result } = renderHook(() => useBrowse());

    await waitFor(() => expect(result.current.featured?.title).toBe('Best'));
  });

  it('groups the catalog into genre rows', async () => {
    listMoviesMock.mockResolvedValue(
      page([
        movieFactory.build({ genre: 'SCI_FI' }),
        movieFactory.build({ genre: 'SCI_FI' }),
        movieFactory.build({ genre: 'HORROR' }),
      ]),
    );

    const { result } = renderHook(() => useBrowse());

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    const sciFi = result.current.rows.find((row) => row.genre === 'SCI_FI');
    expect(sciFi?.movies).toHaveLength(2);
  });

  it('drops genres with no titles', async () => {
    listMoviesMock.mockResolvedValue(page([movieFactory.build({ genre: 'DRAMA' })]));

    const { result } = renderHook(() => useBrowse());

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0]?.genre).toBe('DRAMA');
  });

  it('reports an empty catalog without erroring', async () => {
    listMoviesMock.mockResolvedValue(page([]));

    const { result } = renderHook(() => useBrowse());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.featured).toBeNull();
    expect(result.current.rows).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a failure message', async () => {
    listMoviesMock.mockRejectedValue(
      new ApiError({
        message: 'The catalog is being reindexed. Try again shortly.',
        status: 503,
        kind: 'server',
        url: '/movies',
      }),
    );

    const { result } = renderHook(() => useBrowse());

    await waitFor(() => expect(result.current.error).toBe('The catalog is being reindexed. Try again shortly.'));
  });

  it('ignores an aborted request', async () => {
    listMoviesMock.mockRejectedValue(
      new ApiError({ message: 'Request aborted', status: 0, kind: 'aborted', url: '/movies' }),
    );

    const { result } = renderHook(() => useBrowse());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it('refetches on reload()', async () => {
    listMoviesMock.mockResolvedValue(page(movieFactory.buildMany(1)));

    const { result } = renderHook(() => useBrowse());
    await waitFor(() => expect(listMoviesMock).toHaveBeenCalledTimes(1));

    act(() => result.current.reload());

    await waitFor(() => expect(listMoviesMock).toHaveBeenCalledTimes(2));
  });

  it('aborts the request on unmount', async () => {
    listMoviesMock.mockReturnValue(new Promise(() => {}));

    const { unmount } = renderHook(() => useBrowse());
    const signal = listMoviesMock.mock.calls[0]?.[1]?.signal;

    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
