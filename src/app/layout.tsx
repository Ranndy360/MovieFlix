import type { Metadata, Viewport } from 'next';

import { AuthProvider } from '@/features/auth/components/auth-provider';
import { SiteHeader } from '@/components/layout/site-header';
import { env } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: `${env.appName} — Watch what you love`,
    template: `%s · ${env.appName}`,
  },
  description: 'Browse the catalog, build a watchlist, and rate what you have seen.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#141414',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-canvas text-content antialiased">
        <AuthProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-brand focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
          >
            Skip to content
          </a>

          <SiteHeader />

          {/* The header is fixed; pages that start with a hero opt out of the
              top padding themselves by pulling it back up. */}
          <main id="main" className="min-h-dvh">
            {children}
          </main>

          <footer className="border-t border-line px-4 py-8 text-xs text-content-faint md:px-12">
            <p>MovieFlix — a demo application. Not affiliated with Netflix.</p>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
