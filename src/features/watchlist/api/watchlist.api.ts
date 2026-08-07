import { apiClient, API_ENDPOINTS, type QueryParams } from '@/lib/api';
import type { Paginated, WatchlistEntry, WatchlistQuery, WatchlistStatus } from '@/types/api';

export function listWatchlist(
  query: WatchlistQuery = {},
  options?: { signal?: AbortSignal },
): Promise<Paginated<WatchlistEntry>> {
  return apiClient.get<Paginated<WatchlistEntry>>(API_ENDPOINTS.watchlist.list, {
    query: { ...query } as QueryParams,
    signal: options?.signal,
  });
}

export function addToWatchlist(movieId: string, status?: WatchlistStatus): Promise<WatchlistEntry> {
  return apiClient.post<WatchlistEntry>(API_ENDPOINTS.watchlist.add, {
    movieId,
    ...(status ? { status } : {}),
  });
}

export function updateWatchlistStatus(
  movieId: string,
  status: WatchlistStatus,
): Promise<WatchlistEntry> {
  return apiClient.post<WatchlistEntry>(API_ENDPOINTS.watchlist.entry(movieId), { status });
}

export function removeFromWatchlist(movieId: string): Promise<void> {
  return apiClient.delete(API_ENDPOINTS.watchlist.entry(movieId));
}
