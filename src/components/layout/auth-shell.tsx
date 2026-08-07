import Link from 'next/link';

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/**
 * The signed-out frame: a dark cinematic backdrop with a single elevated card.
 *
 * A Server Component — it holds no state, so only the form inside it ships JS.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps): React.JSX.Element {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-24">
      {/* Layered radial washes stand in for cover art without loading any. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1000px 500px at 15% 10%, rgba(229,9,20,0.28), transparent 60%),' +
            'radial-gradient(900px 500px at 85% 85%, rgba(56,60,120,0.30), transparent 60%),' +
            'linear-gradient(180deg, #0a0a0a 0%, #141414 100%)',
        }}
      />

      <div className="relative w-full max-w-md rounded-md bg-black/75 p-8 shadow-2xl backdrop-blur-sm md:p-12">
        <Link
          href="/"
          className="mb-6 block text-2xl font-black uppercase tracking-tighter text-brand"
        >
          MovieFlix
        </Link>

        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-content-muted">{subtitle}</p> : null}

        <div className="mt-6">{children}</div>

        <div className="mt-6 text-sm text-content-muted">{footer}</div>
      </div>
    </div>
  );
}
