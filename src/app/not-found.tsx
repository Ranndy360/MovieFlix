import Link from 'next/link';

export default function NotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-black tracking-tighter text-brand">404</p>
      <h1 className="text-2xl font-bold">Lost your way?</h1>
      <p className="max-w-md text-sm text-content-muted">
        We could not find that page. You will find plenty to explore on the home page.
      </p>
      <Link
        href="/"
        className="rounded-sm bg-white px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-white/80"
      >
        MovieFlix Home
      </Link>
    </div>
  );
}
