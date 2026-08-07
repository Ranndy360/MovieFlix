import { apiClient, API_ENDPOINTS, type QueryParams } from '@/lib/api';
import type {
  CreateReviewPayload,
  Paginated,
  Review,
  ReviewQuery,
  UpdateReviewPayload,
} from '@/types/api';

/** Public — anyone browsing can read a movie's reviews. */
export function listReviews(
  query: ReviewQuery = {},
  options?: { signal?: AbortSignal },
): Promise<Paginated<Review>> {
  return apiClient.get<Paginated<Review>>(API_ENDPOINTS.reviews.list, {
    query: { ...query } as QueryParams,
    signal: options?.signal,
  });
}

export function listMyReviews(
  query: ReviewQuery = {},
  options?: { signal?: AbortSignal },
): Promise<Paginated<Review>> {
  return apiClient.get<Paginated<Review>>(API_ENDPOINTS.reviews.mine, {
    query: { ...query } as QueryParams,
    signal: options?.signal,
  });
}

/** Fails with 422 unless the movie is marked WATCHED on the caller's list. */
export function createReview(payload: CreateReviewPayload): Promise<Review> {
  return apiClient.post<Review>(API_ENDPOINTS.reviews.create, payload);
}

export function updateReview(id: string, payload: UpdateReviewPayload): Promise<Review> {
  return apiClient.post<Review>(API_ENDPOINTS.reviews.detail(id), payload);
}

export function deleteReview(id: string): Promise<void> {
  return apiClient.delete(API_ENDPOINTS.reviews.detail(id));
}
