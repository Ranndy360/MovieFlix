'use client';

import { useEffect, useState } from 'react';

import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { getProfileStats } from '@/features/profile/api/profile.api';
import { StarRating } from '@/features/reviews/components/star-rating';
import { isApiError } from '@/lib/api';
import { useAuthUser } from '@/store/auth.store';
import { ROLE_LABELS } from '@/types/auth';
import { FeedbackMessage } from '@/components/ui/feedback-message';
import type { ProfileStats } from '@/types/api';

export default function ProfilePage(): React.JSX.Element {
  const { isAllowed, isPending } = useRequireAuth();
  const user = useAuthUser();

  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAllowed) return;

    const controller = new AbortController();

    getProfileStats({ signal: controller.signal })
      .then(setStats)
      .catch((cause: unknown) => {
        if (isApiError(cause) && cause.kind === 'aborted') return;
        setError('Your watch history is safe — the numbers just did not come through. Refresh to try again.');
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [isAllowed]);

  if (isPending || !isAllowed || !user) {
    return (
      <div aria-busy="true" aria-label="Loading profile" className="min-h-dvh px-4 pt-28 md:px-12">
        <div className="h-64 animate-pulse rounded-sm bg-surface-2" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-10 px-4 pb-16 pt-24 md:px-12 md:pt-28">
      <header className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded bg-brand text-2xl font-black"
        >
          {user.firstName.charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">{user.fullName}</h1>
          <p className="text-sm text-content-muted">{user.email}</p>
          <p className="mt-1 inline-block rounded-sm border border-line-strong px-2 py-0.5 text-xs text-content-muted">
            {ROLE_LABELS[user.role]}
          </p>
        </div>
      </header>

      {error ? (
        <FeedbackMessage tone="error" title="We could not load your stats">
          {error}
        </FeedbackMessage>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight">Your stats</h2>

        {isLoading ? (
          <div aria-busy="true" aria-label="Loading stats" className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_unused, i) => (
              <div key={i} className="h-28 animate-pulse rounded-sm bg-surface-2" />
            ))}
          </div>
        ) : stats ? (
          <>
            <dl className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Movies watched" value={String(stats.totalWatched)} />
              <StatCard label="Reviews written" value={String(stats.totalReviews)} />
              <StatCard
                label="Average rating given"
                value={stats.averageRatingGiven === null ? '—' : stats.averageRatingGiven.toFixed(2)}
                footer={
                  stats.averageRatingGiven === null ? (
                    <span className="text-xs text-content-faint">No reviews yet</span>
                  ) : (
                    <StarRating
                      value={Math.round(stats.averageRatingGiven)}
                      readOnly
                      size="sm"
                    />
                  )
                }
              />
            </dl>

            <div className="rounded-sm bg-surface p-5">
              <h3 className="text-sm font-semibold">Watchlist breakdown</h3>
              <dl className="mt-3 grid grid-cols-3 gap-4 text-center">
                <Breakdown label="Want to watch" value={stats.watchlist.want} />
                <Breakdown label="Watching" value={stats.watchlist.watching} />
                <Breakdown label="Watched" value={stats.watchlist.watched} />
              </dl>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  footer,
}: {
  label: string;
  value: string;
  footer?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-sm bg-surface p-5">
      <dt className="text-xs font-medium uppercase tracking-wider text-content-muted">{label}</dt>
      <dd className="mt-1 text-3xl font-black tracking-tight">{value}</dd>
      {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
  );
}

function Breakdown({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs text-content-muted">{label}</dt>
      <dd className="text-2xl font-bold">{value}</dd>
    </div>
  );
}
