/**
 * Partial updates go over **POST**, not PATCH: this deployment's environment
 * rejects PATCH. The paths are unchanged, so `movies.update(id)` is still the
 * update route — only the verb differs. Do not "fix" it back without checking
 * that PATCH survives the network path in front of the API.
 *
 * Every backend path in one place. Nothing else should build an API URL by
 * string concatenation — a route rename then touches exactly this file.
 */
export const API_ENDPOINTS = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    logoutAll: '/auth/logout-all',
    me: '/auth/me',
  },
  users: {
    list: '/users',
    detail: (id: string) => `/users/${encodeURIComponent(id)}`,
    updateRole: (id: string) => `/users/${encodeURIComponent(id)}/role`,
    updateStatus: (id: string) => `/users/${encodeURIComponent(id)}/status`,
  },
  watchlist: {
    list: '/watchlist',
    add: '/watchlist',
    entry: (movieId: string) => `/watchlist/${encodeURIComponent(movieId)}`,
  },
  reviews: {
    list: '/reviews',
    create: '/reviews',
    mine: '/reviews/me',
    detail: (id: string) => `/reviews/${encodeURIComponent(id)}`,
  },
  profile: {
    stats: '/profile/stats',
  },
  movies: {
    list: '/movies',
    create: '/movies',
    detail: (id: string) => `/movies/${encodeURIComponent(id)}`,
    update: (id: string) => `/movies/${encodeURIComponent(id)}`,
    remove: (id: string) => `/movies/${encodeURIComponent(id)}`,
  },
  health: {
    readiness: '/health/readiness',
  },
} as const;
