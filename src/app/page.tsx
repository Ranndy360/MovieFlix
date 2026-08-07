'use client';

import { useEffect, useState } from 'react';

import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { HeroBillboard } from '@/features/movies/components/hero-billboard';
import { MovieDetailDialog } from '@/features/movies/components/movie-detail-dialog';
import { MovieRow } from '@/features/movies/components/movie-row';
import { useBrowse } from '@/features/movies/hooks/use-browse';
import { useIsAuthenticated } from '@/store/auth.store';
import { useWatchlistActions, useWatchlistStore } from '@/store/watchlist.store';
import { GENRE_LABELS, type Movie } from '@/types/api';

export default function HomePage(): React.JSX.Element {
  const { isAllowed, isPending } = useRequireAuth();
  const { featured, trending, rows, isLoading, error, reload } = useBrowse();
  const [selected, setSelected] = useState<Movie | null>(null);

  const isAuthenticated = useIsAuthenticated();
  const isWatchlistLoaded = useWatchlistStore((state) => state.isLoaded);
  const { load } = useWatchlistActions();

  // Load the list index once per signed-in session so every tile can show
  // its own state without a request each.
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

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">We could not load MovieFlix</h1>
        <p role="alert" className="max-w-md text-sm text-content-muted">
          {error}
        </p>
        <button
          type="button"
          onClick={reload}
          className="rounded-sm bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <HeroBillboard movie={featured} onMoreInfo={setSelected} isLoading={isLoading} />

      {/* Pull the rows up over the hero's fade, the way Netflix overlaps them. */}
      <div className="relative z-10 -mt-16 space-y-2 pb-12 md:-mt-32">
        <MovieRow
          title="Top Rated"
          movies={trending}
          onSelect={setSelected}
          isLoading={isLoading}
          priority
        />

        {rows.map((row) => (
          <MovieRow
            key={row.genre}
            title={GENRE_LABELS[row.genre]}
            movies={row.movies}
            onSelect={setSelected}
          />
        ))}

        {!isLoading && trending.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-content-muted md:px-12">
            The catalog is empty. Seed it with{' '}
            <code className="rounded bg-surface-2 px-1">npm run db:seed</code> in the API project.
          </p>
        ) : null}
      </div>

      <MovieDetailDialog movie={selected} onClose={() => setSelected(null)} />
    </>
  );
}
