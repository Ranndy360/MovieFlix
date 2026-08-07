/** Mirrors the API's auth DTOs. Source of truth: `${API}/docs-json`. */

export const ROLES = ['ADMIN', 'PROVIDER', 'USER'] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  PROVIDER: 'Provider',
  USER: 'User',
};

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/**
 * Note the absence of any token field: the API delivers both tokens as
 * `httpOnly` cookies, which JavaScript cannot read by design.
 */
export interface AuthSession {
  user: AuthUser;
  /** Seconds until the access cookie expires. */
  expiresIn: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

/** No `role` field — the API always assigns USER and rejects anything else. */
export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface MessageResponse {
  message: string;
}

/** Mirrors the API's password policy so the UI can validate before submitting. */
export const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 72,
} as const;

export const PASSWORD_RULE_MESSAGE =
  'At least 12 characters, with an uppercase letter, a lowercase letter, a number and a symbol.';

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_POLICY.minLength) return PASSWORD_RULE_MESSAGE;
  if (password.length > PASSWORD_POLICY.maxLength)
    return `Password must not exceed ${PASSWORD_POLICY.maxLength} characters.`;
  if (!/[a-z]/.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!/[A-Z]/.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!/\d/.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!/[^A-Za-z0-9]/.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Enter a valid email address.';
  return null;
}
