'use client';

import { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FeedbackMessage } from '@/components/ui/feedback-message';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { isApiError } from '@/lib/api';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useAuthUser } from '@/store/auth.store';
import {
  GENRE_LABELS,
  MOVIE_GENRES,
  type Movie,
  type MovieGenre,
  type PaginationMeta,
} from '@/types/api';
import { deleteMovie, listMovies, setMoviePublished } from '../api/movies.api';
import { MoviePoster } from './movie-poster';

export interface MovieAdminTableProps {
  /** Bumped by the parent after a create/edit so the list refetches. */
  refreshToken: number;
  onEdit: (movie: Movie) => void;
}

const PAGE_SIZE = 10;

type StatusFilter = 'all' | 'published' | 'unpublished';

interface Criteria {
  search: string;
  genre: MovieGenre | 'all';
  status: StatusFilter;
  page: number;
}

const INITIAL: Criteria = { search: '', genre: 'all', status: 'all', page: 1 };

const SELECT_CLASS =
  'rounded-sm border border-line bg-surface-2 px-3 py-2 text-sm text-white focus:border-white';

export function MovieAdminTable({
  refreshToken,
  onEdit,
}: MovieAdminTableProps): React.JSX.Element {
  const user = useAuthUser();
  const isAdmin = user?.role === 'ADMIN';

  const [movies, setMovies] = useState<Movie[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  /** The row awaiting confirmation; `null` keeps the dialog closed. */
  const [toDelete, setToDelete] = useState<Movie | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // What the user is typing, and what we have committed to querying with. Kept
  // apart so the input stays instant while the request trails behind it.
  const [typedSearch, setTypedSearch] = useState('');
  const debouncedSearch = useDebouncedValue(typedSearch);
  const [criteria, setCriteria] = useState<Criteria>(INITIAL);

  /**
   * Folding the debounced text in resets the page *in the same update*. Split
   * across two state changes it would fire an extra request for page 3 of the
   * old query before settling on page 1 of the new one.
   */
  useEffect(() => {
    setCriteria((current) =>
      current.search === debouncedSearch
        ? current
        : { ...current, search: debouncedSearch, page: 1 },
    );
  }, [debouncedSearch]);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);

      try {
        // An admin manages the whole catalog; a provider only their own, so
        // `mine` is what keeps the table honest about what they can act on.
        const page = await listMovies(
          {
            page: criteria.page,
            pageSize: PAGE_SIZE,
            sortBy: 'createdAt',
            sortDirection: 'DESC',
            ...(isAdmin ? {} : { mine: true }),
            ...(criteria.search ? { search: criteria.search } : {}),
            ...(criteria.genre !== 'all' ? { genre: criteria.genre } : {}),
            ...(criteria.status !== 'all' ? { isPublished: criteria.status === 'published' } : {}),
          },
          signal ? { signal } : undefined,
        );
        setMovies(page.items);
        setMeta(page.meta);
        setError(null);
      } catch (cause) {
        if (isApiError(cause) && cause.kind === 'aborted') return;
        setError(
          isApiError(cause)
            ? cause.toDisplayMessage()
            : 'We could not load your titles. Refresh the page to try again.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isAdmin, criteria],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshToken]);

  async function togglePublished(movie: Movie): Promise<void> {
    setPendingId(movie.id);
    setError(null);

    try {
      const updated = await setMoviePublished(movie.id, !movie.isPublished);
      setMovies((current) => current.map((m) => (m.id === updated.id ? updated : m)));
    } catch (cause) {
      setError(
        isApiError(cause)
          ? cause.toDisplayMessage()
          : 'That publish change did not go through, so the title is unchanged. Try again in a moment.',
      );
    } finally {
      setPendingId(null);
    }
  }

  function askToDelete(movie: Movie): void {
    setDeleteError(null);
    setToDelete(movie);
  }

  function cancelDelete(): void {
    // A dismissal mid-request would strand the row in its pending state.
    if (isDeleting) return;
    setToDelete(null);
  }

  async function confirmDelete(): Promise<void> {
    if (!toDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteMovie(toDelete.id);
      setToDelete(null);
      // Refetch rather than splice the row out: with pages of ten, the title
      // that moves up from the next page would otherwise be missing until
      // something else happened to trigger a load.
      await load();
    } catch (cause) {
      // Stays inside the dialog: an alert behind the backdrop is unreadable,
      // and the user still has the retry button right there.
      setDeleteError(
        isApiError(cause)
          ? cause.toDisplayMessage()
          : 'We could not delete it, so it is still in the catalog. Try again in a moment.',
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const isFiltered = criteria.search !== '' || criteria.genre !== 'all' || criteria.status !== 'all';

  function clearFilters(): void {
    setTypedSearch('');
    setCriteria(INITIAL);
  }

  return (
    <div className="space-y-4">
      {error ? (
        <FeedbackMessage tone="error" title="Something did not work">
          {error}
        </FeedbackMessage>
      ) : null}

      {/* Always mounted. Unmounting the toolbar while a request is in flight
          would pull focus out of the search box on every keystroke. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          id="movie-search"
          label="Search titles"
          placeholder="Search by title…"
          value={typedSearch}
          onChange={setTypedSearch}
          className="sm:max-w-xs sm:flex-1"
        />

        <label className="sr-only" htmlFor="movie-genre-filter">
          Filter by genre
        </label>
        <select
          id="movie-genre-filter"
          value={criteria.genre}
          onChange={(event) =>
            setCriteria((c) => ({ ...c, genre: event.target.value as MovieGenre | 'all', page: 1 }))
          }
          className={SELECT_CLASS}
        >
          <option value="all">All genres</option>
          {MOVIE_GENRES.map((genre) => (
            <option key={genre} value={genre}>
              {GENRE_LABELS[genre]}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="movie-status-filter">
          Filter by status
        </label>
        <select
          id="movie-status-filter"
          value={criteria.status}
          onChange={(event) =>
            setCriteria((c) => ({ ...c, status: event.target.value as StatusFilter, page: 1 }))
          }
          className={SELECT_CLASS}
        >
          <option value="all">Any status</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
        </select>

        {isFiltered ? (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-sm border border-line-strong px-3 py-2 text-sm font-medium transition-colors hover:border-white"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {meta === null && isLoading ? (
        <div
          aria-busy="true"
          aria-label="Loading the catalog"
          className="h-64 animate-pulse rounded-sm bg-surface-2"
        />
      ) : movies.length === 0 ? (
        <div className="space-y-1 rounded-sm border border-dashed border-line px-6 py-12 text-center">
          <p className="font-semibold text-white">
            {isFiltered
              ? 'Nothing matches those filters'
              : isAdmin
                ? 'There are no titles yet'
                : 'You have not added a title yet'}
          </p>
          <p className="text-sm text-content-muted">
            {isFiltered
              ? 'Try a different genre or status, or clear the filters to see everything again.'
              : isAdmin
                ? 'Once you or a provider adds one, it shows up here ready to publish.'
                : 'Use “Add movie” above. An unpublished title stays private until you publish it, so there is no rush to get it perfect.'}
          </p>
        </div>
      ) : (
        <>
          {/* Dimmed rather than replaced: swapping in a skeleton on every
              keystroke would make the table strobe while you type. */}
          <div
            aria-busy={isLoading}
            className={`overflow-x-auto rounded-sm border border-line transition-opacity ${
              isLoading ? 'opacity-50' : ''
            }`}
          >
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                {isAdmin ? 'Every movie in the catalog' : 'The movies you created'}
              </caption>
              <thead className="bg-surface-2 text-xs uppercase text-content-muted">
                <tr>
                  {/* Decorative column: the title beside it is the real label. */}
                  <th scope="col" className="py-3 pl-4 pr-0">
                    <span className="sr-only">Poster</span>
                  </th>
                  <th scope="col" className="px-4 py-3">Title</th>
                  <th scope="col" className="px-4 py-3">Genre</th>
                  <th scope="col" className="px-4 py-3">Year</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  {isAdmin ? <th scope="col" className="px-4 py-3">Owner</th> : null}
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {movies.map((movie) => {
                  const isBusy = pendingId === movie.id;
                  // Mirrors the API rule so the UI never offers a doomed action.
                  const canManage =
                    isAdmin || (movie.createdById !== null && movie.createdById === user?.id);

                  return (
                    <tr key={movie.id} className="border-t border-line">
                      <td className="py-2 pl-4 pr-0">
                        {/* 48px wide: enough to recognise artwork at a glance
                            without turning the row into a poster wall. */}
                        <div className="w-12 overflow-hidden rounded-sm">
                          <MoviePoster movie={movie} sizes="48px" />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{movie.title}</td>
                      <td className="px-4 py-3 text-content-muted">{GENRE_LABELS[movie.genre]}</td>
                      <td className="px-4 py-3 text-content-muted">{movie.releaseYear}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            movie.isPublished
                              ? 'rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success'
                              : 'rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-content-muted'
                          }
                        >
                          {movie.isPublished ? 'Published' : 'Unpublished'}
                        </span>
                      </td>
                      {isAdmin ? (
                        <td className="px-4 py-3 text-xs text-content-faint">
                          {movie.createdById === null
                            ? 'seeded'
                            : movie.createdById === user?.id
                              ? 'you'
                              : movie.createdById.slice(0, 8)}
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={isBusy || !canManage}
                            onClick={() => void togglePublished(movie)}
                            className="rounded-sm border border-line-strong px-3 py-1 text-xs font-medium transition-colors hover:border-white disabled:opacity-40"
                          >
                            {movie.isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy || !canManage}
                            onClick={() => onEdit(movie)}
                            className="rounded-sm border border-line-strong px-3 py-1 text-xs font-medium transition-colors hover:border-white disabled:opacity-40"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={isBusy || !canManage}
                            onClick={() => askToDelete(movie)}
                            className="rounded-sm border border-brand/60 px-3 py-1 text-xs font-medium text-brand transition-colors hover:border-brand hover:bg-brand hover:text-white disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {meta ? (
            <Pagination
              meta={meta}
              itemLabel="title"
              isBusy={isLoading}
              onPageChange={(page) => setCriteria((c) => ({ ...c, page }))}
            />
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this movie?"
        description="It disappears from the catalog, from every watchlist it sits on, and takes its reviews with it. This cannot be undone."
        confirmLabel="Delete movie"
        busyLabel="Deleting…"
        cancelLabel="Keep it"
        isBusy={isDeleting}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={cancelDelete}
        preview={
          toDelete ? (
            <div className="flex items-center gap-3 rounded-sm border border-line bg-surface-2 p-3">
              <div className="w-12 shrink-0 overflow-hidden rounded-sm">
                <MoviePoster movie={toDelete} sizes="48px" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{toDelete.title}</p>
                <p className="text-xs text-content-muted">
                  {GENRE_LABELS[toDelete.genre]} · {toDelete.releaseYear} ·{' '}
                  {toDelete.isPublished ? 'Published' : 'Unpublished'}
                </p>
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
}
