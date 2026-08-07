'use client';

import { useEffect } from 'react';

/** Route-level error boundary. Must be a Client Component. */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    // Replace with a real reporter (Sentry, etc.) when one exists.
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto mt-32 max-w-lg space-y-4 rounded-sm border border-line p-8 text-center">
      <h2 className="text-lg font-semibold">This page did not load</h2>
      <p className="text-sm text-content-muted">
        Something broke on our side, not yours. Try again — and if it keeps happening, come back in
        a few minutes.
      </p>
      {error.digest ? (
        <p className="text-xs text-content-faint">
          Reference <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="rounded-sm bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
      >
        Try again
      </button>
    </div>
  );
}
