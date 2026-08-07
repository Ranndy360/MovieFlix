'use client';

import { useState } from 'react';

import { FeedbackMessage } from '@/components/ui/feedback-message';
import { isApiError } from '@/lib/api';
import { PASSWORD_RULE_MESSAGE, ROLES, ROLE_LABELS, validateEmail, validatePassword } from '@/types/auth';
import type { AuthUser, Role } from '@/types/auth';
import { createUser } from '../api/users.api';

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
}

const FIELD_CLASS =
  'w-full rounded-sm border border-line bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-content-faint focus:border-white';

export interface UserFormProps {
  onCreated: (user: AuthUser) => void;
  onCancel: () => void;
}

/**
 * Admin-only account creation.
 *
 * This is the one place a PROVIDER or ADMIN can be minted from the UI —
 * self-service signup is hard-wired to USER on the API.
 */
export function UserForm({ onCreated, onCancel }: UserFormProps): React.JSX.Element {
  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'USER' as Role,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]): void =>
    setValues((current) => ({ ...current, [key]: value }));

  function validate(): FieldErrors {
    const errors: FieldErrors = {};

    if (!values.firstName.trim()) errors.firstName = 'First name is required.';
    if (!values.lastName.trim()) errors.lastName = 'Last name is required.';

    const emailError = validateEmail(values.email);
    if (emailError) errors.email = emailError;

    const passwordError = validatePassword(values.password);
    if (passwordError) errors.password = passwordError;

    return errors;
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setServerError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    try {
      const created = await createUser({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        role: values.role,
      });

      onCreated(created);
    } catch (cause) {
      setServerError(isApiError(cause) ? cause.toDisplayMessage() : 'Could not create the user.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const field = (
    id: keyof FieldErrors,
    label: string,
    type = 'text',
    autoComplete = 'off',
    help?: string,
  ): React.JSX.Element => (
    <div className="space-y-1">
      <label htmlFor={`user-${id}`} className="block text-sm font-medium text-content-muted">
        {label}
      </label>
      <input
        id={`user-${id}`}
        type={type}
        autoComplete={autoComplete}
        value={values[id]}
        onChange={(e) => set(id, e.target.value)}
        aria-invalid={Boolean(fieldErrors[id])}
        aria-describedby={fieldErrors[id] ? `user-${id}-error` : help ? `user-${id}-help` : undefined}
        className={FIELD_CLASS}
      />
      {help && !fieldErrors[id] ? (
        <p id={`user-${id}-help`} className="text-xs text-content-faint">
          {help}
        </p>
      ) : null}
      {fieldErrors[id] ? (
        <p id={`user-${id}-error`} className="text-xs text-brand">
          {fieldErrors[id]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError ? (
        <FeedbackMessage tone="error" title="We could not create this account">
          {serverError}
        </FeedbackMessage>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {field('firstName', 'First name', 'text', 'given-name')}
        {field('lastName', 'Last name', 'text', 'family-name')}
      </div>

      {field('email', 'Email', 'email', 'email')}
      {field('password', 'Temporary password', 'password', 'new-password', PASSWORD_RULE_MESSAGE)}

      <div className="space-y-1">
        <label htmlFor="user-role" className="block text-sm font-medium text-content-muted">
          Role
        </label>
        <select
          id="user-role"
          value={values.role}
          onChange={(e) => set('role', e.target.value as Role)}
          className={`${FIELD_CLASS} sm:w-64`}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <p className="text-xs text-content-faint">
          Providers can add and manage their own movies. Administrators manage everything.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-sm bg-brand px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {isSubmitting ? 'Creating…' : 'Create user'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-sm border border-line-strong px-6 py-2.5 text-sm font-semibold text-content-muted transition-colors hover:border-white hover:text-white disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
