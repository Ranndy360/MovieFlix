import { apiClient, API_ENDPOINTS } from '@/lib/api';
import type {
  AuthSession,
  AuthUser,
  LoginPayload,
  MessageResponse,
  RegisterPayload,
} from '@/types/auth';

/**
 * Typed resource layer for the auth endpoints.
 *
 * Every call sends cookies (`withCredentials` on the shared client) and none of
 * them ever sees a token — the browser stores and replays the `httpOnly`
 * cookies the API sets.
 */

/** `skipAuthRefresh`: a 401 here IS the auth failure; retrying would loop. */
export function login(payload: LoginPayload): Promise<AuthSession> {
  return apiClient.post<AuthSession>(API_ENDPOINTS.auth.login, payload, {
    skipAuthRefresh: true,
  });
}

export function register(payload: RegisterPayload): Promise<AuthSession> {
  return apiClient.post<AuthSession>(API_ENDPOINTS.auth.register, payload, {
    skipAuthRefresh: true,
  });
}

export function refreshSession(): Promise<AuthSession> {
  return apiClient.post<AuthSession>(API_ENDPOINTS.auth.refresh, undefined, {
    skipAuthRefresh: true,
  });
}

export function logout(): Promise<MessageResponse> {
  return apiClient.post<MessageResponse>(API_ENDPOINTS.auth.logout, undefined, {
    skipAuthRefresh: true,
  });
}

export function logoutEverywhere(): Promise<MessageResponse> {
  return apiClient.post<MessageResponse>(API_ENDPOINTS.auth.logoutAll, undefined, {
    skipAuthRefresh: true,
  });
}

/**
 * The session bootstrap: on a cold page load the cookies may still be valid,
 * and this is the only way to find out — they are unreadable from JS.
 */
export function getCurrentUser(): Promise<AuthUser> {
  return apiClient.get<AuthUser>(API_ENDPOINTS.auth.me);
}
