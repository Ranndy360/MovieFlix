import { apiClient, API_ENDPOINTS, type QueryParams } from '@/lib/api';
import type {
  CreateMoviePayload,
  Movie,
  MovieListQuery,
  Paginated,
  UpdateMoviePayload,
} from '@/types/api';

/**
 * Typed resource layer for the movies endpoints.
 *
 * Components and hooks call these functions; they never touch `apiClient`
 * directly. That keeps the request shape (paths, query keys, payloads) in one
 * testable place and makes a backend contract change a single-file edit.
 */

/** `MovieListQuery` is already flat and serializable — this just narrows it. */
const toQueryParams = (query: MovieListQuery): QueryParams => ({ ...query });

export function listMovies(
  query: MovieListQuery = {},
  options?: { signal?: AbortSignal; revalidate?: number },
): Promise<Paginated<Movie>> {
  return apiClient.get<Paginated<Movie>>(API_ENDPOINTS.movies.list, {
    query: toQueryParams(query),
    signal: options?.signal,
    next: options?.revalidate === undefined ? undefined : { revalidate: options.revalidate },
  });
}

export function getMovie(id: string, options?: { signal?: AbortSignal }): Promise<Movie> {
  return apiClient.get<Movie>(API_ENDPOINTS.movies.detail(id), { signal: options?.signal });
}

export function createMovie(payload: CreateMoviePayload): Promise<Movie> {
  return apiClient.post<Movie>(API_ENDPOINTS.movies.create, payload);
}

/**
 * Same endpoint, sent as `multipart/form-data` so a poster file can ride along.
 *
 * `HttpClient` detects `FormData` and leaves `Content-Type` unset, letting the
 * browser add the multipart boundary — setting it by hand produces a body the
 * server cannot parse. Every value goes over the wire as a string; the API
 * converts them explicitly (`@Type`, `@ToBoolean`), so `false` stays `false`.
 */
export function createMovieWithPoster(
  payload: CreateMoviePayload,
  poster: File | null,
): Promise<Movie> {
  const form = new FormData();

  form.append('title', payload.title);
  form.append('genre', payload.genre);
  form.append('releaseYear', String(payload.releaseYear));
  form.append('durationMinutes', String(payload.durationMinutes));
  form.append('isPublished', String(payload.isPublished ?? false));

  if (payload.synopsis) form.append('synopsis', payload.synopsis);
  if (payload.rating !== undefined) form.append('rating', String(payload.rating));
  if (poster) form.append('poster', poster);

  return apiClient.post<Movie>(API_ENDPOINTS.movies.create, form);
}

export function updateMovie(id: string, payload: UpdateMoviePayload): Promise<Movie> {
  return apiClient.post<Movie>(API_ENDPOINTS.movies.update(id), payload);
}

/**
 * Update, replacing the artwork. Only send this when the user actually picked
 * a file — omitting `poster` entirely is what tells the API to keep the
 * current one, so an empty field must not be appended.
 */
export function updateMovieWithPoster(
  id: string,
  payload: UpdateMoviePayload,
  poster: File,
): Promise<Movie> {
  const form = new FormData();

  if (payload.title !== undefined) form.append('title', payload.title);
  if (payload.genre !== undefined) form.append('genre', payload.genre);
  if (payload.releaseYear !== undefined) form.append('releaseYear', String(payload.releaseYear));
  if (payload.durationMinutes !== undefined) {
    form.append('durationMinutes', String(payload.durationMinutes));
  }
  if (payload.isPublished !== undefined) form.append('isPublished', String(payload.isPublished));
  if (payload.synopsis !== undefined) form.append('synopsis', payload.synopsis);
  if (payload.rating !== undefined) form.append('rating', String(payload.rating));

  form.append('poster', poster);

  return apiClient.post<Movie>(API_ENDPOINTS.movies.update(id), form);
}

/** Publish / unpublish. A PATCH with a single field. */
export function setMoviePublished(id: string, isPublished: boolean): Promise<Movie> {
  return apiClient.post<Movie>(API_ENDPOINTS.movies.update(id), { isPublished });
}

export function deleteMovie(id: string): Promise<void> {
  return apiClient.delete(API_ENDPOINTS.movies.remove(id));
}
