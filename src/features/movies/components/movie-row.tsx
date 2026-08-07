'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';
import type { Movie } from '@/types/api';
import { MovieCard } from './movie-card';

export interface MovieRowProps {
  title: string;
  movies: Movie[];
  onSelect: (movie: Movie) => void;
  isLoading?: boolean;
  priority?: boolean;
}

const SKELETON_COUNT = 7;

/** `aria-labelledby` splits on whitespace, so the id must not contain any. */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * A horizontally scrolling carousel.
 *
 * Built on native overflow scrolling with CSS snap rather than a JS carousel:
 * trackpad, touch and keyboard all work for free, and the arrows are a
 * progressive enhancement layered on top. The arrows hide at the ends so they
 * never look interactive when they are not.
 */
export function MovieRow({
  title,
  movies,
  onSelect,
  isLoading = false,
  priority = false,
}: MovieRowProps): React.JSX.Element | null {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncArrows = useCallback((): void => {
    const track = trackRef.current;
    if (!track) return;

    setCanScrollLeft(track.scrollLeft > 8);
    // 8px of slack absorbs sub-pixel rounding at the far end.
    setCanScrollRight(track.scrollLeft + track.clientWidth < track.scrollWidth - 8);
  }, []);

  useEffect(() => {
    syncArrows();

    const track = trackRef.current;
    if (!track) return;

    const observer = new ResizeObserver(syncArrows);
    observer.observe(track);

    return () => observer.disconnect();
  }, [syncArrows, movies.length, isLoading]);

  const scrollByPage = (direction: -1 | 1): void => {
    const track = trackRef.current;
    if (!track) return;

    // Leave one tile visible for continuity, the way Netflix does.
    track.scrollBy({ left: direction * (track.clientWidth * 0.85), behavior: 'smooth' });
  };

  // An empty row is noise — render nothing rather than a lonely heading.
  if (!isLoading && movies.length === 0) return null;

  const headingId = `row-${slugify(title)}`;

  return (
    <section className="group/row relative py-4" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-2 px-4 text-lg font-bold tracking-tight md:px-12 md:text-xl"
      >
        {title}
      </h2>

      <div className="relative">
        <ul
          ref={trackRef}
          onScroll={syncArrows}
          className="scrollbar-none flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-4 pb-8 md:px-12"
        >
          {isLoading
            ? Array.from({ length: SKELETON_COUNT }, (_unused, index) => (
                <li
                  key={index}
                  className="w-[45vw] shrink-0 sm:w-[30vw] md:w-[22vw] lg:w-[16vw] xl:w-[13vw]"
                >
                  <div className="aspect-[2/3] animate-pulse rounded-card bg-surface-2" />
                </li>
              ))
            : movies.map((movie, index) => (
                <li
                  key={movie.id}
                  className="w-[45vw] shrink-0 snap-start sm:w-[30vw] md:w-[22vw] lg:w-[16vw] xl:w-[13vw]"
                >
                  <MovieCard
                    movie={movie}
                    onSelect={onSelect}
                    priority={priority && index < 6}
                  />
                </li>
              ))}
        </ul>

        <RowArrow
          direction="left"
          visible={canScrollLeft}
          onClick={() => scrollByPage(-1)}
          label={`Scroll ${title} left`}
        />
        <RowArrow
          direction="right"
          visible={canScrollRight}
          onClick={() => scrollByPage(1)}
          label={`Scroll ${title} right`}
        />
      </div>
    </section>
  );
}

function RowArrow({
  direction,
  visible,
  onClick,
  label,
}: {
  direction: 'left' | 'right';
  visible: boolean;
  onClick: () => void;
  label: string;
}): React.JSX.Element | null {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute top-0 z-20 hidden h-[calc(100%-2rem)] w-12 items-center justify-center bg-black/40 text-white md:flex',
        'opacity-0 transition-opacity duration-200 hover:bg-black/70 group-hover/row:opacity-100 focus-visible:opacity-100',
        direction === 'left' ? 'left-0' : 'right-0',
      )}
    >
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
        />
      </svg>
    </button>
  );
}
