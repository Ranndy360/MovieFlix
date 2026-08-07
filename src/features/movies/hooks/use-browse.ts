'use client';

import { useCallback, useEffect, useState } from 'react';

import { listMovies } from '@/features/movies/api/movies.api';
import { isApiError } from '@/lib/api';
import { MOVIE_GENRES, type Movie, type MovieGenre } from '@/types/api';

export interface GenreRow {
  genre: MovieGenre;
  movies: Movie[];
}

export interface UseBrowseResult {
  featured: Movie | null;
  trending: Movie[];
  rows: GenreRow[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

const ROW_SIZE = 20;

/**
 * Loads everything the home page needs in one pass.
 *
 * The catalog is fetched once (not once per genre) and grouped on the client:
 * with a catalog this size that is a single round trip instead of ten, and the
 * rows stay consistent with each other. If the catalog outgrows one page, this
 * is the seam to replace with a purpose-built endpoint.
 */
export function useBrowse(): UseBrowseResult {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setIsLoading(true);
    setError(null);

    listMovies(
      // `isPublished: true` is pinned for the same reason as the browse page:
      // the catalog is what the audience sees, drafts live in /admin/movies.
      { pageSize: 100, sortBy: 'rating', sortDirection: 'DESC', isPublished: true },
      { signal: controller.signal },
    )
      .then((page) => {
        if (!active) return;
        setMovies(page.items);
      })
      .catch((cause: unknown) => {
        if (!active || (isApiError(cause) && cause.kind === 'aborted')) return;
        setError(
          isApiError(cause)
            ? cause.toDisplayMessage()
            : 'We could not reach the catalog. Check your connection and try again.',
        );
        setMovies([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const rows: GenreRow[] = MOVIE_GENRES.map((genre) => ({
    genre,
    movies: movies.filter((movie) => movie.genre === genre).slice(0, ROW_SIZE),
  })).filter((row) => row.movies.length > 0);

  return {
    // Highest rated leads the page — `sortBy: rating` already put it first.
    featured: movies[0] ?? null,
    trending: movies.slice(0, ROW_SIZE),
    rows,
    isLoading,
    error,
    reload,
  };
}
