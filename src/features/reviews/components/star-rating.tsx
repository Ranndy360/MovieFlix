'use client';

import { useId, useState } from 'react';

import { cn } from '@/lib/utils/cn';
import { MAX_RATING, MIN_RATING } from '@/types/api';

export interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  /** Read-only mode renders plain text + stars, with no form controls. */
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' } as const;

/**
 * A 1–5 star control.
 *
 * The editable version is a **radio group of real inputs** with the stars as
 * their labels, rather than a row of buttons. That gives arrow-key navigation,
 * a single tab stop, correct announcement ("3 of 5 stars, radio button") and
 * native form semantics — none of which a div-with-onClick provides.
 */
export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 'md',
  className,
}: StarRatingProps): React.JSX.Element {
  const groupId = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const stars = Array.from({ length: MAX_RATING }, (_unused, index) => index + MIN_RATING);

  if (readOnly) {
    return (
      <span className={cn('inline-flex items-center gap-0.5', className)}>
        <span className="sr-only">{value} out of 5 stars</span>
        {stars.map((star) => (
          <Star key={star} filled={star <= value} className={SIZE_CLASS[size]} />
        ))}
      </span>
    );
  }

  const shown = hovered ?? value;

  return (
    <fieldset
      className={cn('inline-flex items-center gap-1', className)}
      onMouseLeave={() => setHovered(null)}
    >
      <legend className="sr-only">Your rating, 1 to 5 stars</legend>

      {stars.map((star) => (
        <label
          key={star}
          onMouseEnter={() => setHovered(star)}
          className="cursor-pointer p-0.5 transition-transform hover:scale-110"
        >
          <input
            type="radio"
            name={`rating-${groupId}`}
            value={star}
            checked={value === star}
            onChange={() => onChange?.(star)}
            className="sr-only"
          />
          <span className="sr-only">{`${star} star${star === 1 ? '' : 's'}`}</span>
          <Star filled={star <= shown} className={SIZE_CLASS[size]} />
        </label>
      ))}

      <span aria-hidden="true" className="ml-2 text-sm font-semibold text-content-muted">
        {shown > 0 ? `${shown}/5` : ''}
      </span>
    </fieldset>
  );
}

function Star({ filled, className }: { filled: boolean; className: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(className, filled ? 'text-brand' : 'text-content-faint')}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinejoin="round"
        d="M12 3.5l2.6 5.3 5.9.9-4.3 4.2 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5z"
      />
    </svg>
  );
}
