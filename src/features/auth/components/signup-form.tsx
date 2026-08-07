'use client';

import { useState, type FormEvent } from 'react';

import { FeedbackMessage } from '@/components/ui/feedback-message';
import { cn } from '@/lib/utils/cn';
import { useAuthActions, useAuthError } from '@/store/auth.store';
import { PASSWORD_RULE_MESSAGE, validateEmail, validatePassword } from '@/types/auth';

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
}

export function SignupForm(): React.JSX.Element {
  const { register, clearError } = useAuthActions();
  const serverError = useAuthError();

  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Per field, so revealing one password does not reveal the confirmation. */
  const [revealed, setRevealed] = useState<Partial<Record<keyof typeof values, boolean>>>({});

  const update =
    (field: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement>): void =>
      setValues((current) => ({ ...current, [field]: event.target.value }));

  function validate(): FieldErrors {
    const errors: FieldErrors = {};

    if (!values.firstName.trim()) errors.firstName = 'First name is required.';
    if (!values.lastName.trim()) errors.lastName = 'Last name is required.';

    const emailError = validateEmail(values.email);
    if (emailError) errors.email = emailError;

    const passwordError = validatePassword(values.password);
    if (passwordError) errors.password = passwordError;

    if (values.password !== values.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    clearError();

    const errors = validate();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    // No role is sent. The API assigns USER, and rejects the request outright
    // if a `role` property is present at all.
    const ok = await register({
      email: values.email,
      password: values.password,
      firstName: values.firstName,
      lastName: values.lastName,
    });

    setIsSubmitting(false);

    if (ok) {
      /*
       * Home, via a real navigation rather than the client router.
       *
       * `router.replace` followed by `router.refresh` is the same pattern that
       * used to strand the sign-out: the refresh lands on the replace still in
       * flight and cancels it, and you are left sitting on the form you just
       * submitted with no clue why. Nothing retries, because nothing is
       * watching.
       *
       * Arriving at a session is as much of a boundary as leaving one. A fresh
       * document means the middleware runs with the cookies the API just set,
       * and every store starts from the new account rather than inheriting
       * whatever the page held a moment ago.
       */
      window.location.assign('/');
    }
  }

  const field = (
    id: keyof typeof values,
    label: string,
    type: string,
    autoComplete: string,
    help?: string,
  ): React.JSX.Element => {
    const isPassword = type === 'password';
    const isRevealed = revealed[id] === true;

    return (
      <div className="space-y-1">
        <label htmlFor={`signup-${id}`} className="block text-sm font-medium text-content-muted">
          {label}
        </label>

        {/*
          The border lives on this wrapper, not on the input, so the toggle is
          a sibling *inside* the field rather than an icon floated on top of it.
          Absolute positioning would look similar until something shifted — a
          zoomed browser, a longer control — and then the eye would drift over
          the edge. Here it cannot: the field is a flex row and the button is
          one of its children. `focus-within` moves the focus outline to the
          whole field, which is what the input's own `focus:border-white` used
          to do.
        */}
        <div className="flex items-center rounded-sm border border-line bg-surface-2 focus-within:border-white">
          <input
            id={`signup-${id}`}
            name={id}
            // Swapping the type is the whole mechanism. `autoComplete` stays
            // `new-password` either way, so a password manager keeps offering
            // to save it even while the characters are on screen.
            type={isPassword && isRevealed ? 'text' : type}
            autoComplete={autoComplete}
            required
            value={values[id]}
            onChange={update(id)}
            aria-invalid={Boolean(fieldErrors[id])}
            aria-describedby={
              fieldErrors[id] ? `signup-${id}-error` : help ? `signup-${id}-help` : undefined
            }
            className={cn(
              'w-full min-w-0 rounded-sm bg-transparent px-4 py-3 text-sm text-white placeholder:text-content-faint focus:outline-none',
              // The toggle owns the right edge, so the text stops before it.
              isPassword && 'pr-1',
            )}
          />

          {isPassword ? (
            <button
              type="button"
              onClick={() => setRevealed((current) => ({ ...current, [id]: !current[id] }))}
              className="shrink-0 self-stretch rounded-r-sm px-3 text-content-faint transition-colors hover:text-white"
            >
              {/*
                The accessible name carries both the action and the state, and
                names the field with it — "Show password" and "Show confirm
                password" have to be told apart when there are two on screen.
              */}
              <span className="sr-only">
                {isRevealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="size-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.5 12S6.5 5 12 5s9.5 7 9.5 7-4 7-9.5 7-9.5-7-9.5-7Z"
                />
                <circle cx="12" cy="12" r="3" />
                {isRevealed ? <path strokeLinecap="round" d="m4 20 16-16" /> : null}
              </svg>
            </button>
          ) : null}
        </div>

        {help && !fieldErrors[id] ? (
          <p id={`signup-${id}-help`} className="text-xs text-content-muted">
            {help}
          </p>
        ) : null}
        {fieldErrors[id] ? (
          <p id={`signup-${id}-error`} className="text-xs text-brand">
            {fieldErrors[id]}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError ? (
        <FeedbackMessage tone="error" title="We could not create your account">
          {serverError}
        </FeedbackMessage>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {field('firstName', 'First name', 'text', 'given-name')}
        {field('lastName', 'Last name', 'text', 'family-name')}
      </div>

      {field('email', 'Email', 'email', 'email')}
      {field('password', 'Password', 'password', 'new-password', PASSWORD_RULE_MESSAGE)}
      {field('confirmPassword', 'Confirm password', 'password', 'new-password')}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-sm bg-brand px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
