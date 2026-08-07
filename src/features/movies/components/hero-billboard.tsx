'use client';

import { WatchlistControls } from '@/features/watchlist/components/watchlist-controls';
import { GENRE_LABELS, type Movie } from '@/types/api';
import { MoviePoster } from './movie-poster';

export interface HeroBillboardProps {
  movie: Movie | null;
  onMoreInfo: (movie: Movie) => void;
  isLoading?: boolean;
}

/** Full-bleed feature at the top of the home page. */
export function HeroBillboard({
  movie,
  onMoreInfo,
  isLoading = false,
}: HeroBillboardProps): React.JSX.Element {
  if (isLoading || !movie) {
    return (
      <div
        aria-busy={isLoading}
        aria-label={isLoading ? 'Loading featured movie' : undefined}
        className="relative h-[56vh] min-h-[380px] w-full animate-pulse bg-surface-2 md:h-[80vh]"
      />
    );
  }

  return (
    <section className="relative h-[56vh] min-h-[380px] w-full md:h-[80vh]" aria-label="Featured">
      <div className="absolute inset-0">
        <MoviePoster movie={movie} ratio="backdrop" sizes="100vw" priority className="h-full" />
      </div>

      {/* Two scrims: bottom fades into the first row, left carries the copy. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas via-canvas/30 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-canvas/95 via-canvas/50 to-transparent" />

      <div className="absolute inset-0 flex items-end pb-16 md:items-center md:pb-0">
        <div className="w-full max-w-2xl space-y-4 px-4 md:px-12">
          {/* Hierarchy comes from size, weight and tracking — every line in
              the billboard is white, so nothing competes with the artwork. */}
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-content text-shadow-hero">
            Featured · {GENRE_LABELS[movie.genre]}
          </p>

          <h1 className="text-3xl font-black leading-tight tracking-tight text-content text-shadow-hero md:text-6xl">
            {movie.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 text-sm text-content text-shadow-hero">
            <span className="font-semibold text-success">{movie.rating.toFixed(1)}</span>
            <span>{movie.releaseYear}</span>
            <span aria-hidden="true">·</span>
            <span>{movie.durationMinutes} min</span>
          </div>

          {movie.synopsis ? (
            <p className="line-clamp-3 max-w-xl text-sm text-white ">
              {movie.synopsis}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onMoreInfo(movie)}
              className="inline-flex items-center gap-2 rounded-sm bg-white px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-white/80 md:text-base"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </button>

            <button
              type="button"
              onClick={() => onMoreInfo(movie)}
              className="inline-flex items-center gap-2 rounded-sm bg-overlay px-6 py-2.5 text-sm font-bold text-white ring-1 ring-white/25 transition-all hover:bg-overlay-hover hover:ring-white/70 md:text-base"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" d="M12 11v5M12 8h.01" />
              </svg>
              More Info
            </button>

            <WatchlistControls movieId={movie.id} variant="compact" />
          </div>
        </div>
      </div>
    </section>
  );
}
