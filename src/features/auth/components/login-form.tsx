'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { FeedbackMessage } from '@/components/ui/feedback-message';
import { useAuthActions, useAuthError } from '@/store/auth.store';
import { validateEmail } from '@/types/auth';

export function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, clearError } = useAuthActions();
  const serverError = useAuthError();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    clearError();

    // Client validation is a courtesy that saves a round trip; the API
    // validates everything again regardless.
    const emailError = validateEmail(email);
    const passwordError = password.length === 0 ? 'Password is required.' : undefined;

    if (emailError || passwordError) {
      setFieldErrors({ ...(emailError ? { email: emailError } : {}), ...(passwordError ? { password: passwordError } : {}) });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const ok = await login({ email, password });

    setIsSubmitting(false);

    if (ok) {
      // Only same-origin paths: an open redirect here would let a phishing
      // link bounce a freshly-authenticated user to an attacker's page.
      const next = searchParams.get('next');
      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/movies';
      router.replace(target);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError ? (
        <FeedbackMessage tone="error" title="We could not sign you in">
          {serverError}
        </FeedbackMessage>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="login-email" className="block text-sm font-medium text-content-muted">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
          className="w-full rounded-sm border border-line bg-surface-2 px-4 py-3 text-sm text-white placeholder:text-content-faint focus:border-white"
        />
        {fieldErrors.email ? (
          <p id="login-email-error" className="text-xs text-brand">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="login-password" className="block text-sm font-medium text-content-muted">
          Password
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
          className="w-full rounded-sm border border-line bg-surface-2 px-4 py-3 text-sm text-white placeholder:text-content-faint focus:border-white"
        />
        {fieldErrors.password ? (
          <p id="login-password-error" className="text-xs text-brand">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-sm bg-brand px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
