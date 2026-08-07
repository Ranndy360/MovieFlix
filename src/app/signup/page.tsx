import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthShell } from '@/components/layout/auth-shell';
import { SignupForm } from '@/features/auth/components/signup-form';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create a MovieFlix account.',
};

export default function SignupPage(): React.JSX.Element {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Build a watchlist and rate what you have seen."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-white hover:underline">
            Sign in
          </Link>
          .
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
