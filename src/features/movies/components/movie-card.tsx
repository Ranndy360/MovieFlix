'use client';

import { cn } from '@/lib/utils/cn';
import { formatRuntime } from '@/lib/utils/format';
import { useWatchlistStatus } from '@/store/watchlist.store';
import { GENRE_LABELS, WATCHLIST_STATUS_LABELS, type Movie } from '@/types/api';
import { MoviePoster } from './movie-poster';

export interface MovieCardProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
  priority?: boolean;
  className?: string;
}

/**
 * One tile in a row or grid.
 *
 * It is a single `<button>`, not a div with a click handler: the whole tile is
 * one action (open details), so it must be reachable by Tab and activate on
 * Enter/Space without any extra wiring.
 */
export function MovieCard({
  movie,
  onSelect,
  priority = false,
  className,
}: MovieCardProps): React.JSX.Element {
  const status = useWatchlistStatus(movie.id);

  return (
    <button
      type="button"
      onClick={() => onSelect(movie)}
      aria-label={`${movie.title}, ${movie.releaseYear}. View details`}
      className={cn(
        'group relative block w-full overflow-hidden rounded-card bg-surface text-left',
        'transition-transform duration-300 ease-[var(--ease-out-expo)]',
        'hover:z-10 hover:scale-105 focus-visible:z-10 focus-visible:scale-105',
        className,
      )}
    >
      <MoviePoster movie={movie} priority={priority} />

      {status ? (
        <span className="absolute left-2 top-2 rounded-sm bg-black/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          {status === 'WATCHED' ? '✓ Watched' : WATCHLIST_STATUS_LABELS[status]}
        </span>
      ) : null}

      {/* Detail overlay: hidden until hover/focus, so the row stays clean. */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black via-black/85 to-transparent p-3 opacity-0',
          'transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100',
          'group-focus-visible:translate-y-0 group-focus-visible:opacity-100',
        )}
      >
        <p className="line-clamp-1 text-sm font-semibold">{movie.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-content-muted">
          <span className="font-semibold text-success">{movie.rating.toFixed(1)}</span>
          <span>{movie.releaseYear}</span>
          <span aria-hidden="true">·</span>
          <span>{formatRuntime(movie.durationMinutes)}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-content-faint">{GENRE_LABELS[movie.genre]}</p>
      </div>
    </button>
  );
}
