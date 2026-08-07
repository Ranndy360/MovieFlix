'use client';

import { formatRelativeTime, initialsOf } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { Review } from '@/types/api';
import { StarRating } from './star-rating';

export interface ReviewThreadItemProps {
  review: Review;
  isMine: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  isBusy?: boolean;
}

/** A review author who predates the `author` field, or whose account is gone. */
const UNKNOWN_AUTHOR = 'A viewer';

/**
 * One comment in the thread.
 *
 * Laid out as avatar + body rather than as a card, which is what makes a run of
 * them read as a conversation instead of a stack of receipts. The rating sits
 * on the byline next to the name, because in a thread the interesting question
 * is "who said what", and the stars are part of what they said.
 */
export function ReviewThreadItem({
  review,
  isMine,
  onEdit,
  onDelete,
  isBusy = false,
}: ReviewThreadItemProps): React.JSX.Element {
  const name = review.author?.fullName ?? UNKNOWN_AUTHOR;
  // A second of drift on save is not an edit; a minute of difference is.
  const wasEdited = new Date(review.updatedAt).getTime() - new Date(review.createdAt).getTime() > 60_000;

  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          isMine ? 'bg-brand text-white' : 'bg-surface-3 text-content-muted',
        )}
      >
        {initialsOf(name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-white">{isMine ? 'You' : name}</span>
          <StarRating value={review.rating} readOnly size="sm" />
          <span className="text-xs text-content-faint">
            <time dateTime={review.createdAt}>{formatRelativeTime(review.createdAt)}</time>
            {wasEdited ? ' · edited' : ''}
          </span>
        </div>

        {review.comment ? (
          <p className="mt-1 whitespace-pre-line text-sm text-content">{review.comment}</p>
        ) : (
          <p className="mt-1 text-sm italic text-content-faint">Rated it, but left no comment.</p>
        )}

        {isMine && (onEdit ?? onDelete) ? (
          <div className="mt-1.5 flex gap-3">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                disabled={isBusy}
                className="text-xs font-semibold text-content-muted transition-colors hover:text-white disabled:opacity-50"
              >
                Edit
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={isBusy}
                className="text-xs font-semibold text-content-muted transition-colors hover:text-brand disabled:opacity-50"
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
