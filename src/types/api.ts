/**
 * Wire types mirroring MovieFlix-api's DTOs.
 * Source of truth is the OpenAPI contract at `${API}/docs-json`.
 */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export type SortDirection = 'ASC' | 'DESC';

export const MOVIE_GENRES = [
  'ACTION',
  'ADVENTURE',
  'ANIMATION',
  'COMEDY',
  'DOCUMENTARY',
  'DRAMA',
  'HORROR',
  'ROMANCE',
  'SCI_FI',
  'THRILLER',
] as const;

export type MovieGenre = (typeof MOVIE_GENRES)[number];

export interface Movie {
  id: string;
  title: string;
  synopsis: string | null;
  genre: MovieGenre;
  releaseYear: number;
  durationMinutes: number;
  rating: number;
  posterUrl: string | null;
  isPublished: boolean;
  /** Who added it. `null` for seeded rows — only an ADMIN can manage those. */
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMoviePayload {
  title: string;
  synopsis?: string;
  genre: MovieGenre;
  releaseYear: number;
  durationMinutes: number;
  rating?: number;
  posterUrl?: string;
  isPublished?: boolean;
}

export type UpdateMoviePayload = Partial<CreateMoviePayload>;

export type MovieSortBy = 'title' | 'releaseYear' | 'rating' | 'createdAt';

export interface MovieListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  genre?: MovieGenre;
  releaseYear?: number;
  isPublished?: boolean;
  /** Only the movies the caller created. Drives the management screen. */
  mine?: boolean;
  sortBy?: MovieSortBy;
  sortDirection?: SortDirection;
}

/** Human-readable labels for the genre enum. */
export const GENRE_LABELS: Record<MovieGenre, string> = {
  ACTION: 'Action',
  ADVENTURE: 'Adventure',
  ANIMATION: 'Animation',
  COMEDY: 'Comedy',
  DOCUMENTARY: 'Documentary',
  DRAMA: 'Drama',
  HORROR: 'Horror',
  ROMANCE: 'Romance',
  SCI_FI: 'Sci-Fi',
  THRILLER: 'Thriller',
};

/* ---------------- watchlist ---------------- */

export const WATCHLIST_STATUSES = ['WANT', 'WATCHING', 'WATCHED'] as const;

export type WatchlistStatus = (typeof WATCHLIST_STATUSES)[number];

export const WATCHLIST_STATUS_LABELS: Record<WatchlistStatus, string> = {
  WANT: 'Want to watch',
  WATCHING: 'Watching',
  WATCHED: 'Watched',
};

export interface WatchlistEntry {
  id: string;
  movieId: string;
  status: WatchlistStatus;
  watchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  movie?: Movie;
}

export interface WatchlistQuery {
  page?: number;
  pageSize?: number;
  status?: WatchlistStatus;
  sortBy?: 'createdAt' | 'updatedAt' | 'watchedAt';
  sortDirection?: SortDirection;
}

/* ---------------- reviews ---------------- */

export const MIN_RATING = 1;
export const MAX_RATING = 5;

/** Who wrote a review. The API deliberately withholds the email. */
export interface ReviewAuthor {
  id: string;
  fullName: string;
}

export interface Review {
  id: string;
  movieId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  movie?: Movie;
  author?: ReviewAuthor;
}

export interface CreateReviewPayload {
  movieId: string;
  rating: number;
  comment?: string;
}

/** `movieId` is intentionally absent: the API rejects it on a PATCH. */
export interface UpdateReviewPayload {
  rating?: number;
  comment?: string;
}

export interface ReviewQuery {
  page?: number;
  pageSize?: number;
  movieId?: string;
  sortBy?: 'createdAt' | 'rating';
  sortDirection?: SortDirection;
}

/* ---------------- profile ---------------- */

export interface ProfileStats {
  totalWatched: number;
  averageRatingGiven: number | null;
  totalReviews: number;
  watchlist: { want: number; watching: number; watched: number; total: number };
}
