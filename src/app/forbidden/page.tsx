import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Access denied' };

export default function ForbiddenPage(): React.JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Access denied</h1>
      <p className="max-w-md text-sm text-content-muted">
        Your account does not have permission to view this page.
      </p>
      <Link
        href="/"
        className="rounded-sm bg-white px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-white/80"
      >
        Back to home
      </Link>
    </div>
  );
}
