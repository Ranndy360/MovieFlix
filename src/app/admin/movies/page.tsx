'use client';

import { useState } from 'react';

import { CollapsiblePanel } from '@/components/ui/collapsible-panel';
import { FeedbackMessage } from '@/components/ui/feedback-message';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { MovieAdminTable } from '@/features/movies/components/movie-admin-table';
import { MovieForm } from '@/features/movies/components/movie-form';
import { useAuthUser } from '@/store/auth.store';
import type { Movie } from '@/types/api';

/**
 * Catalog management for ADMIN and PROVIDER.
 *
 * The list is the point of the page, so it leads; the form is opened on
 * demand. An admin manages everything, a provider only what they created —
 * and `MoviesService` enforces exactly the same rule on every request.
 */
export default function ManageMoviesPage(): React.JSX.Element {
  const { isAllowed, isPending } = useRequireAuth(['ADMIN', 'PROVIDER']);
  const user = useAuthUser();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Movie | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);

  if (isPending || !isAllowed) {
    return (
      <div
        aria-busy={isPending}
        aria-label="Checking permissions"
        className="min-h-dvh px-4 pt-24 md:px-12 md:pt-28"
      >
        <div className="h-64 animate-pulse rounded-sm bg-surface-2" />
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';

  function close(): void {
    setIsFormOpen(false);
    setEditing(null);
  }

  /**
   * The useful half of "we saved it" is what that means for the catalog, and
   * that depends on whether the title is published. Saying so here is what
   * stops a provider from wondering why their new movie is nowhere to be found.
   */
  function handleSaved(movie: Movie): void {
    const wasEditing = editing !== null;
    close();
    setRefreshToken((token) => token + 1);

    setNotice(
      movie.isPublished
        ? {
            title: wasEditing ? `Your changes to “${movie.title}” are live` : `“${movie.title}” is live`,
            body: 'Anyone browsing MovieFlix can find it and add it to their list.',
          }
        : {
            title: wasEditing
              ? `Your changes to “${movie.title}” are saved`
              : `“${movie.title}” is saved, but not published`,
            body: 'Only you and the admins can see it. Publish it from the table below when it is ready.',
          },
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-24 md:px-12 md:pt-28">
      <header className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight">Manage the catalog</h1>
        <p className="text-sm text-content-muted">
          {isAdmin
            ? 'As an administrator you can edit, publish and delete every title.'
            : 'You can edit, publish and delete the titles you created.'}{' '}
          Unpublished titles stay out of the catalog for everyone else.
        </p>
      </header>

      {notice ? (
        <FeedbackMessage tone="success" title={notice.title} onDismiss={() => setNotice(null)}>
          {notice.body}
        </FeedbackMessage>
      ) : null}

      <CollapsiblePanel
        id="movie-form"
        open={isFormOpen}
        onToggle={() => (isFormOpen ? close() : setIsFormOpen(true))}
        openLabel="Add movie"
        title={editing ? `Editing “${editing.title}”` : isAdmin ? 'All titles' : 'Your titles'}
      >
        <MovieForm
          // Remounting on target change reseeds the inputs without an effect.
          key={editing?.id ?? 'new'}
          {...(editing ? { movie: editing } : {})}
          onSaved={handleSaved}
          onCancel={close}
        />
      </CollapsiblePanel>

      <MovieAdminTable
        refreshToken={refreshToken}
        onEdit={(movie) => {
          setEditing(movie);
          setIsFormOpen(true);
          setNotice(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </section>
  );
}
