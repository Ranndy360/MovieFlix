import { apiClient, API_ENDPOINTS } from '@/lib/api';
import type { ProfileStats } from '@/types/api';

export function getProfileStats(options?: { signal?: AbortSignal }): Promise<ProfileStats> {
  return apiClient.get<ProfileStats>(API_ENDPOINTS.profile.stats, { signal: options?.signal });
}
