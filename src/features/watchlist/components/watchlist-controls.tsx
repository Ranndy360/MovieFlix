'use client';

import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils/cn';
import { useIsAuthenticated } from '@/store/auth.store';
import {
  useIsWatchlistPending,
  useWatchlistActions,
  useWatchlistStatus,
} from '@/store/watchlist.store';
import { WATCHLIST_STATUSES, WATCHLIST_STATUS_LABELS, type WatchlistStatus } from '@/types/api';

export interface WatchlistControlsProps {
  movieId: string;
  /** `compact` is the circular +/✓ for the hero; `full` is the status picker. */
  variant?: 'compact' | 'full';
  className?: string;
}

export function WatchlistControls({
  movieId,
  variant = 'compact',
  className,
}: WatchlistControlsProps): React.JSX.Element {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const status = useWatchlistStatus(movieId);
  const isPending = useIsWatchlistPending(movieId);
  const { setStatus, remove } = useWatchlistActions();

  // Sending an anonymous visitor to sign in beats a 401 they cannot act on.
  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/login?next=${encodeURIComponent('/movies')}`)}
        className={cn(
          'inline-flex items-center gap-2 rounded-sm border border-white/70 bg-overlay px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-overlay-hover',
          className,
        )}
      >
        <PlusIcon /> My List
      </button>
    );
  }

  if (variant === 'compact') {
    const onList = status !== undefined;

    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => (onList ? void remove(movieId) : void setStatus(movieId, 'WANT'))}
        aria-pressed={onList}
        aria-label={onList ? 'Remove from my list' : 'Add to my list'}
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/70 bg-overlay text-white transition-colors',
          'hover:border-white hover:bg-overlay-hover disabled:opacity-50',
          className,
        )}
      >
        {onList ? <CheckIcon /> : <PlusIcon />}
      </button>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-content-muted">
        My list
      </p>

      <div role="group" aria-label="Watchlist status" className="flex flex-wrap gap-2">
        {WATCHLIST_STATUSES.map((option) => {
          const isActive = status === option;

          return (
            <button
              key={option}
              type="button"
              disabled={isPending}
              aria-pressed={isActive}
              onClick={() =>
                isActive ? void remove(movieId) : void setStatus(movieId, option as WatchlistStatus)
              }
              className={cn(
                'rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
                isActive
                  ? 'border-white bg-white text-black'
                  : 'border-line-strong text-content-muted hover:border-white hover:text-white',
              )}
            >
              {WATCHLIST_STATUS_LABELS[option]}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-content-faint">
        {status === 'WATCHED'
          ? 'Marked as watched — you can leave a review below.'
          : 'Mark a movie as watched to review it.'}
      </p>
    </div>
  );
}

function PlusIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CheckIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
