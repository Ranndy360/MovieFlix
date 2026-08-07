'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { FeedbackMessage } from '@/components/ui/feedback-message';
import { MovieCard } from '@/features/movies/components/movie-card';
import { MovieDetailDialog } from '@/features/movies/components/movie-detail-dialog';
import { listWatchlist } from '@/features/watchlist/api/watchlist.api';
import { isApiError } from '@/lib/api';
import { useWatchlistStore } from '@/store/watchlist.store';
import {
  WATCHLIST_STATUSES,
  WATCHLIST_STATUS_LABELS,
  type Movie,
  type WatchlistEntry,
  type WatchlistStatus,
} from '@/types/api';

export default function MyListPage(): React.JSX.Element {
  const { isAllowed, isPending } = useRequireAuth();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Movie | null>(null);

  // The index drives the tile badges; re-reading it keeps this page in sync
  // after a status change made from inside the detail modal.
  const index = useWatchlistStore((state) => state.byMovieId);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setIsLoading(true);

    try {
      const page = await listWatchlist({ pageSize: 100 }, signal ? { signal } : undefined);
      setEntries(page.items);
      setError(null);
    } catch (cause) {
      if (isApiError(cause) && cause.kind === 'aborted') return;
      setError(isApiError(cause) ? cause.toDisplayMessage() : 'Your list is still there — we just could not fetch it. Refresh to try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAllowed) return;

    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [isAllowed, load]);

  if (isPending || !isAllowed) {
    return (
      <div
        aria-busy="true"
        aria-label="Checking your session"
        className="min-h-dvh px-4 pt-28 md:px-12"
      >
        <div className="h-64 animate-pulse rounded-sm bg-surface-2" />
      </div>
    );
  }

  // Only show entries whose movie is still on the index — a removal made in
  // the modal should disappear here immediately, without a refetch.
  const visible = entries.filter((entry) => index[entry.movieId] !== undefined);

  const groups = WATCHLIST_STATUSES.map((status) => ({
    status: status as WatchlistStatus,
    items: visible.filter((entry) => index[entry.movieId] === status),
  }));

  const isEmpty = !isLoading && visible.length === 0;

  return (
    <>
      <section className="space-y-10 px-4 pb-16 pt-24 md:px-12 md:pt-28">
        <header className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight">My List</h1>
          <p className="text-sm text-content-muted">
            Everything you have saved, grouped by where you are with it.
          </p>
        </header>

        {error ? (
          <FeedbackMessage tone="error" title="We could not load your list">
            {error}
          </FeedbackMessage>
        ) : null}

        {isLoading ? (
          <div
            aria-busy="true"
            aria-label="Loading your list"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
          >
            {Array.from({ length: 6 }, (_unused, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-card bg-surface-2" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="space-y-4 rounded-sm border border-dashed border-line px-6 py-20 text-center">
            <p className="text-lg font-semibold">Your list is empty</p>
            <p className="text-sm text-content-muted">
              Add titles from the catalog and they will show up here.
            </p>
            <Link
              href="/movies"
              className="inline-block rounded-sm bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Browse the catalog
            </Link>
          </div>
        ) : (
          groups.map((group) =>
            group.items.length === 0 ? null : (
              <section key={group.status} className="space-y-3">
                <h2 className="text-lg font-bold tracking-tight">
                  {WATCHLIST_STATUS_LABELS[group.status]}
                  <span className="ml-2 text-sm font-normal text-content-faint">
                    {group.items.length}
                  </span>
                </h2>

                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {group.items.map((entry) =>
                    entry.movie ? (
                      <li key={entry.id}>
                        <MovieCard movie={entry.movie} onSelect={setSelected} />
                      </li>
                    ) : null,
                  )}
                </ul>
              </section>
            ),
          )
        )}
      </section>

      <MovieDetailDialog movie={selected} onClose={() => setSelected(null)} />
    </>
  );
}
