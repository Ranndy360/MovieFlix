import { apiClient, API_ENDPOINTS, type QueryParams } from '@/lib/api';
import type { Paginated } from '@/types/api';
import type { AuthUser, Role } from '@/types/auth';

export interface UserListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

/** Every endpoint here is ADMIN-only on the API. */
export function listUsers(
  query: UserListQuery = {},
  options?: { signal?: AbortSignal },
): Promise<Paginated<AuthUser>> {
  return apiClient.get<Paginated<AuthUser>>(API_ENDPOINTS.users.list, {
    query: { ...query } as QueryParams,
    signal: options?.signal,
  });
}

export interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
}

/** Admin-only. The one route that can mint an ADMIN or PROVIDER. */
export function createUser(payload: CreateUserPayload): Promise<AuthUser> {
  return apiClient.post<AuthUser>(API_ENDPOINTS.users.list, payload);
}

export function updateUserRole(id: string, role: Role): Promise<AuthUser> {
  return apiClient.post<AuthUser>(API_ENDPOINTS.users.updateRole(id), { role });
}

export function updateUserStatus(id: string, isActive: boolean): Promise<AuthUser> {
  return apiClient.post<AuthUser>(API_ENDPOINTS.users.updateStatus(id), { isActive });
}
