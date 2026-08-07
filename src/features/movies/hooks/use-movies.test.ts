import { act, renderHook, waitFor } from '@testing-library/react';

import { ApiError } from '@/lib/api';
import { buildMoviePage } from '@/testing/factories/movie.factory';
import { listMovies } from '../api/movies.api';
import { useMovies } from './use-movies';

jest.mock('../api/movies.api');

const listMoviesMock = listMovies as jest.MockedFunction<typeof listMovies>;

describe('useMovies', () => {
  it('starts in the loading state', () => {
    listMoviesMock.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useMovies());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.movies).toEqual([]);
  });

  it('exposes items and meta once resolved', async () => {
    const page = buildMoviePage(3);
    listMoviesMock.mockResolvedValue(page);

    const { result } = renderHook(() => useMovies());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.movies).toEqual(page.items);
    expect(result.current.meta).toEqual(page.meta);
    expect(result.current.error).toBeNull();
  });

  it('forwards the query to the API', async () => {
    listMoviesMock.mockResolvedValue(buildMoviePage(0));

    renderHook(() => useMovies({ page: 2, search: 'dune' }));

    await waitFor(() =>
      expect(listMoviesMock).toHaveBeenCalledWith(
        { page: 2, search: 'dune' },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });

  it('surfaces a displayable message on failure', async () => {
    listMoviesMock.mockRejectedValue(
      new ApiError({
        message: 'The catalog is being reindexed. Try again shortly.',
        status: 503,
        kind: 'server',
        url: '/movies',
      }),
    );

    const { result } = renderHook(() => useMovies());

    await waitFor(() => expect(result.current.error).toBe('The catalog is being reindexed. Try again shortly.'));
    expect(result.current.movies).toEqual([]);
    expect(result.current.meta).toBeNull();
  });

  it('falls back to a generic message for a non-ApiError', async () => {
    listMoviesMock.mockRejectedValue(new Error('kaboom'));

    const { result } = renderHook(() => useMovies());

    await waitFor(() => expect(result.current.error).toBe('We could not load these titles. Try again in a moment.'));
  });

  it('ignores an aborted request instead of reporting it', async () => {
    listMoviesMock.mockRejectedValue(
      new ApiError({ message: 'Request aborted', status: 0, kind: 'aborted', url: '/movies' }),
    );

    const { result } = renderHook(() => useMovies());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it('does not refetch when an equivalent query object is passed again', async () => {
    listMoviesMock.mockResolvedValue(buildMoviePage(1));

    const { rerender } = renderHook(({ q }) => useMovies(q), {
      initialProps: { q: { page: 1 } },
    });

    await waitFor(() => expect(listMoviesMock).toHaveBeenCalledTimes(1));

    // A fresh object literal with the same contents must not retrigger.
    rerender({ q: { page: 1 } });

    await waitFor(() => expect(listMoviesMock).toHaveBeenCalledTimes(1));
  });

  it('refetches when the query actually changes', async () => {
    listMoviesMock.mockResolvedValue(buildMoviePage(1));

    const { rerender } = renderHook(({ q }) => useMovies(q), {
      initialProps: { q: { page: 1 } },
    });

    await waitFor(() => expect(listMoviesMock).toHaveBeenCalledTimes(1));

    rerender({ q: { page: 2 } });

    await waitFor(() => expect(listMoviesMock).toHaveBeenCalledTimes(2));
  });

  it('refetches on demand via refetch()', async () => {
    listMoviesMock.mockResolvedValue(buildMoviePage(1));

    const { result } = renderHook(() => useMovies());

    await waitFor(() => expect(listMoviesMock).toHaveBeenCalledTimes(1));

    act(() => result.current.refetch());

    await waitFor(() => expect(listMoviesMock).toHaveBeenCalledTimes(2));
  });

  it('aborts the in-flight request on unmount', async () => {
    listMoviesMock.mockReturnValue(new Promise(() => {}));

    const { unmount } = renderHook(() => useMovies());
    const signal = listMoviesMock.mock.calls[0]?.[1]?.signal;

    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
