'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { isApiError } from '@/lib/api';
import type { Movie, MovieListQuery, PaginationMeta } from '@/types/api';
import { listMovies } from '../api/movies.api';

export interface UseMoviesResult {
  movies: Movie[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Client-side movie fetching keyed off `query`.
 *
 * Two things this gets right and hand-rolled effects usually don't:
 *  - every in-flight request is aborted when the query changes, so a slow
 *    response can never overwrite a newer one;
 *  - `query` is serialized for the dependency array, so callers can pass an
 *    object literal without triggering an infinite loop.
 *
 * For anything beyond this (dedupe, cache, mutations) reach for TanStack Query
 * rather than growing this hook.
 */
export function useMovies(query: MovieListQuery = {}): UseMoviesResult {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const serializedQuery = JSON.stringify(query);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setIsLoading(true);
    setError(null);

    listMovies(queryRef.current, { signal: controller.signal })
      .then((page) => {
        if (!active) return;
        setMovies(page.items);
        setMeta(page.meta);
      })
      .catch((cause: unknown) => {
        // An abort is our own doing, not a failure to report.
        if (!active || (isApiError(cause) && cause.kind === 'aborted')) return;
        setError(isApiError(cause) ? cause.toDisplayMessage() : 'We could not load these titles. Try again in a moment.');
        setMovies([]);
        setMeta(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [serializedQuery, reloadToken]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { movies, meta, isLoading, error, refetch };
}
