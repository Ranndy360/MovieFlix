'use client';

import { useEffect, useState } from 'react';

import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { MovieDetailDialog } from '@/features/movies/components/movie-detail-dialog';
import { MovieFiltersBar } from '@/features/movies/components/movie-filters-bar';
import { MovieGrid } from '@/features/movies/components/movie-grid';
import { useMovies } from '@/features/movies/hooks/use-movies';
import { useIsAuthenticated } from '@/store/auth.store';
import {
  toMovieListQuery,
  useMovieFilterActions,
  useMovieFilters,
} from '@/store/movie-filters.store';
import { useWatchlistActions, useWatchlistStore } from '@/store/watchlist.store';
import type { Movie } from '@/types/api';

export default function BrowsePage(): React.JSX.Element {
  const { isAllowed, isPending } = useRequireAuth();
  const filters = useMovieFilters();
  const { setPage } = useMovieFilterActions();
  const { movies, meta, isLoading, error, refetch } = useMovies(toMovieListQuery(filters));
  const [selected, setSelected] = useState<Movie | null>(null);

  const isAuthenticated = useIsAuthenticated();
  const isWatchlistLoaded = useWatchlistStore((state) => state.isLoaded);
  const { load } = useWatchlistActions();

  useEffect(() => {
    if (isAuthenticated && !isWatchlistLoaded) void load();
  }, [isAuthenticated, isWatchlistLoaded, load]);

  if (isPending || !isAllowed) {
    return (
      <div
        aria-busy={isPending}
        aria-label="Checking your session"
        className="min-h-dvh px-4 pt-24 md:px-12 md:pt-28"
      >
        <div className="h-64 animate-pulse rounded-sm bg-surface-2" />
      </div>
    );
  }

  return (
    <>
      <section className="space-y-6 px-4 pb-16 pt-24 md:px-12 md:pt-28">
        <header className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight">Browse</h1>
          <p className="text-sm text-content-muted">
            Search the catalog, then add titles to your list.
          </p>
        </header>

        <MovieFiltersBar />

        <MovieGrid
          movies={movies}
          meta={meta}
          isLoading={isLoading}
          error={error}
          onSelect={setSelected}
          onRetry={refetch}
          onPageChange={setPage}
        />
      </section>

      <MovieDetailDialog movie={selected} onClose={() => setSelected(null)} />
    </>
  );
}
