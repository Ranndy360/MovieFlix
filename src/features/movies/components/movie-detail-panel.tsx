'use client';

import { ReviewSection } from '@/features/reviews/components/review-section';
import { WatchlistControls } from '@/features/watchlist/components/watchlist-controls';
import { formatRuntime } from '@/lib/utils/format';
import { GENRE_LABELS, type Movie } from '@/types/api';
import { MoviePoster } from './movie-poster';

export interface MovieDetailPanelProps {
  movie: Movie;
  onClose: () => void;
}

/**
 * The contents of the detail modal, kept separate from the `<dialog>` shell so
 * it can be rendered and tested without a real modal environment.
 */
export function MovieDetailPanel({ movie, onClose }: MovieDetailPanelProps): React.JSX.Element {
  return (
    <article className="relative">
      <div className="relative">
        <MoviePoster
          movie={movie}
          ratio="backdrop"
          sizes="(max-width: 900px) 100vw, 900px"
          priority
        />
        {/* Scrim: guarantees contrast for the title over any artwork. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
          <h2 id="movie-detail-title" className="text-2xl font-black tracking-tight text-shadow-hero md:text-4xl">
            {movie.title}
          </h2>
        </div>
      </div>

      <div className="space-y-6 p-5 md:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-semibold text-success">{movie.rating.toFixed(1)} rating</span>
          <span className="text-content-muted">{movie.releaseYear}</span>
          <span className="text-content-muted" aria-hidden="true">·</span>
          <span className="text-content-muted">{formatRuntime(movie.durationMinutes)}</span>
          <span className="rounded-sm border border-line-strong px-1.5 py-0.5 text-xs text-content-muted">
            {GENRE_LABELS[movie.genre]}
          </span>
          {!movie.isPublished ? (
            <span className="rounded-sm bg-surface-3 px-1.5 py-0.5 text-xs text-content-muted">
              Unpublished
            </span>
          ) : null}
        </div>

        {movie.synopsis ? (
          <p className="max-w-prose text-sm leading-relaxed text-content-muted md:text-base">
            {movie.synopsis}
          </p>
        ) : null}

        <WatchlistControls movieId={movie.id} variant="full" />

        <hr className="border-line" />

        <ReviewSection movieId={movie.id} />
      </div>
    </article>
  );
}
