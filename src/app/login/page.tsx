import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { AuthShell } from '@/components/layout/auth-shell';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to MovieFlix.',
};

export default function LoginPage(): React.JSX.Element {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Pick up where you left off."
      footer={
        <>
          New to MovieFlix?{' '}
          <Link href="/signup" className="font-semibold text-white hover:underline">
            Sign up now
          </Link>
          .
        </>
      }
    >
      {/* `useSearchParams` needs a boundary to keep the route statically rendered. */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-sm bg-surface-2" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
