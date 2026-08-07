'use client';

import type { Movie, PaginationMeta } from '@/types/api';
import { MovieCard } from './movie-card';

export interface MovieGridProps {
  movies: Movie[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  onSelect: (movie: Movie) => void;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}

const SKELETON_COUNT = 12;

export function MovieGrid({
  movies,
  meta,
  isLoading,
  error,
  onSelect,
  onRetry,
  onPageChange,
}: MovieGridProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading movies"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
      >
        {Array.from({ length: SKELETON_COUNT }, (_unused, index) => (
          <div key={index} className="aspect-[2/3] animate-pulse rounded-card bg-surface-2" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="space-y-3 rounded-sm border border-line p-8 text-center">
        <p className="font-semibold">We could not load the catalog</p>
        <p className="mx-auto max-w-sm text-sm text-content-muted">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="space-y-1 rounded-sm border border-dashed border-line px-6 py-16 text-center">
        <p className="font-semibold text-white">Nothing matches those filters</p>
        <p className="text-sm text-content-muted">
          Try another genre, or clear the search to see everything again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {movies.map((movie, index) => (
          <li key={movie.id}>
            <MovieCard movie={movie} onSelect={onSelect} priority={index < 6} />
          </li>
        ))}
      </ul>

      {meta && meta.totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
          <button
            type="button"
            disabled={!meta.hasPreviousPage}
            onClick={() => onPageChange(meta.page - 1)}
            className="rounded-sm border border-line-strong px-4 py-2 text-sm font-medium transition-colors hover:border-white disabled:opacity-40 disabled:hover:border-line-strong"
          >
            Previous
          </button>

          <span className="text-sm text-content-muted">
            Page {meta.page} of {meta.totalPages} · {meta.totalItems} titles
          </span>

          <button
            type="button"
            disabled={!meta.hasNextPage}
            onClick={() => onPageChange(meta.page + 1)}
            className="rounded-sm border border-line-strong px-4 py-2 text-sm font-medium transition-colors hover:border-white disabled:opacity-40 disabled:hover:border-line-strong"
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
