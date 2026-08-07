'use client';

import { useMovieFilterActions, useMovieFilters } from '@/store/movie-filters.store';
import { GENRE_LABELS, MOVIE_GENRES, type MovieGenre, type MovieSortBy } from '@/types/api';

const SORT_OPTIONS: { value: MovieSortBy; label: string }[] = [
  { value: 'createdAt', label: 'Recently added' },
  { value: 'rating', label: 'Top rated' },
  { value: 'releaseYear', label: 'Newest releases' },
  { value: 'title', label: 'A–Z' },
];

const FIELD_CLASS =
  'rounded-sm border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-content-faint focus:border-white';

export function MovieFiltersBar(): React.JSX.Element {
  const { search, genre, sortBy } = useMovieFilters();
  const { setSearch, setGenre, setSort, reset } = useMovieFilterActions();

  const hasFilters = search !== '' || genre !== null || sortBy !== 'createdAt';

  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="movie-search" className="text-xs font-medium text-content-muted">
          Search
        </label>
        <input
          id="movie-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Title contains…"
          className={`${FIELD_CLASS} w-full sm:w-64`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="movie-genre" className="text-xs font-medium text-content-muted">
          Genre
        </label>
        <select
          id="movie-genre"
          value={genre ?? ''}
          onChange={(event) => setGenre((event.target.value || null) as MovieGenre | null)}
          className={`${FIELD_CLASS} w-44`}
        >
          <option value="">All genres</option>
          {MOVIE_GENRES.map((value) => (
            <option key={value} value={value}>
              {GENRE_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="movie-sort" className="text-xs font-medium text-content-muted">
          Sort by
        </label>
        <select
          id="movie-sort"
          value={sortBy}
          onChange={(event) =>
            // Title reads naturally ascending; everything else best-first.
            setSort(
              event.target.value as MovieSortBy,
              event.target.value === 'title' ? 'ASC' : 'DESC',
            )
          }
          className={`${FIELD_CLASS} w-48`}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {hasFilters ? (
        <button
          type="button"
          onClick={reset}
          className="rounded-sm border border-line-strong px-3 py-2 text-sm font-medium text-content-muted transition-colors hover:border-white hover:text-white"
        >
          Reset
        </button>
      ) : null}
    </form>
  );
}
