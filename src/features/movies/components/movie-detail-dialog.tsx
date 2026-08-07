'use client';

import { useEffect, useRef } from 'react';

import type { Movie } from '@/types/api';
import { MovieDetailPanel } from './movie-detail-panel';

export interface MovieDetailDialogProps {
  movie: Movie | null;
  onClose: () => void;
}

/**
 * Modal shell built on the native `<dialog>` element.
 *
 * `showModal()` gives focus trapping, Escape-to-close, inertness of the page
 * behind, and top-layer stacking — all of it correct, and none of it code we
 * have to write or keep correct. A hand-rolled modal would need a focus trap,
 * a scroll lock, `aria-modal`, and focus restoration; this needs none.
 */
export function MovieDetailDialog({ movie, onClose }: MovieDetailDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (movie && !dialog.open) {
      dialog.showModal();
      // The page behind must not scroll while the modal owns the viewport.
      document.body.style.overflow = 'hidden';
    } else if (!movie && dialog.open) {
      dialog.close();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [movie]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="movie-detail-title"
      onClose={onClose}
      // Clicking the backdrop lands on the <dialog> itself, never on its child.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="w-full max-w-3xl overflow-y-auto rounded-lg bg-surface p-0 text-content shadow-2xl backdrop:bg-black/75 md:my-8"
    >
      {movie ? <MovieDetailPanel movie={movie} onClose={onClose} /> : null}
    </dialog>
  );
}
