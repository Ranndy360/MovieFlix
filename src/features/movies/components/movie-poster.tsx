'use client';

import Image from 'next/image';
import { useState } from 'react';

import { cn } from '@/lib/utils/cn';
import { posterGradient, posterInitials } from '@/lib/utils/poster';
import type { Movie } from '@/types/api';

export interface MoviePosterProps {
  movie: Movie;
  /** `poster` is 2:3, `backdrop` is 16:9. */
  ratio?: 'poster' | 'backdrop';
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/**
 * A movie's artwork, with a designed fallback.
 *
 * `onError` matters as much as the missing-URL case: a link that 404s at
 * runtime would otherwise leave a broken-image glyph in the middle of a row.
 */
export function MoviePoster({
  movie,
  ratio = 'poster',
  sizes = '(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 16vw',
  priority = false,
  className,
}: MoviePosterProps): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const showFallback = !movie.posterUrl || failed;

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-surface-2',
        ratio === 'poster' ? 'aspect-[2/3]' : 'aspect-video',
        className,
      )}
    >
      {showFallback ? (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center"
          style={{ backgroundImage: posterGradient(movie.title, movie.genre) }}
          // Decorative: the accessible name comes from the surrounding link.
          aria-hidden="true"
        >
          <span className="text-3xl font-black tracking-tight text-white/90">
            {posterInitials(movie.title)}
          </span>
          <span className="line-clamp-2 text-[11px] font-semibold uppercase tracking-wider text-white/70">
            {movie.title}
          </span>
        </div>
      ) : (
        <Image
          src={movie.posterUrl as string}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
