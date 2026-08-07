'use client';

import { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FeedbackMessage } from '@/components/ui/feedback-message';
import { isApiError } from '@/lib/api';
import { useAuthUser } from '@/store/auth.store';
import { useWatchlistStatus } from '@/store/watchlist.store';
import { MIN_RATING, type PaginationMeta, type Review } from '@/types/api';
import { createReview, deleteReview, listReviews, updateReview } from '../api/reviews.api';
import { ReviewThreadItem } from './review-thread-item';
import { StarRating } from './star-rating';

export interface ReviewSectionProps {
  movieId: string;
}

const PAGE_SIZE = 10;

/**
 * The conversation about one movie, plus the caller's way into it.
 *
 * Read oldest-first, so the thread accumulates downward and a new comment lands
 * where you would expect it — at the bottom, after what it is responding to.
 * Everyone's review lives in the same list, including the caller's: pulling
 * your own out into a separate box above made the page look like a form with a
 * log attached rather than somewhere people are talking.
 *
 * The API is the authority on both business rules; this mirrors them so the
 * user is never invited to do something that will 422 — the composer only
 * appears once the movie is marked WATCHED, and once you have had your say it
 * gives way to your comment in the thread.
 */
export function ReviewSection({ movieId }: ReviewSectionProps): React.JSX.Element {
  const currentUser = useAuthUser();
  const watchlistStatus = useWatchlistStatus(movieId);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  /** A missing rating is a nudge, not a breakage — the tone has to say so. */
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; title: string; body: string } | null>(
    null,
  );

  const fail = (title: string, body: string): void => setNotice({ tone: 'error', title, body });

  const myReview = currentUser ? reviews.find((r) => r.userId === currentUser.id) : undefined;
  const canReview = watchlistStatus === 'WATCHED' && currentUser !== null;

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);

      try {
        const page = await listReviews(
          // Oldest first: the thread reads top to bottom and grows downward.
          { movieId, pageSize: PAGE_SIZE, sortBy: 'createdAt', sortDirection: 'ASC' },
          signal ? { signal } : undefined,
        );
        setReviews(page.items);
        setMeta(page.meta);
        setNotice(null);
      } catch (cause) {
        if (isApiError(cause) && cause.kind === 'aborted') return;
        fail(
          'We could not load the reviews',
          'Other people have had their say — we just could not fetch it. Try again in a moment.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [movieId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /** Appends the next page instead of replacing, so the thread keeps growing. */
  async function loadMore(): Promise<void> {
    if (!meta?.hasNextPage) return;

    setIsLoadingMore(true);

    try {
      const next = await listReviews({
        movieId,
        page: meta.page + 1,
        pageSize: PAGE_SIZE,
        sortBy: 'createdAt',
        sortDirection: 'ASC',
      });
      // Guard against a review that shifted pages between requests showing twice.
      setReviews((current) => {
        const seen = new Set(current.map((review) => review.id));
        return [...current, ...next.items.filter((review) => !seen.has(review.id))];
      });
      setMeta(next.meta);
    } catch (cause) {
      fail(
        'We could not load more reviews',
        isApiError(cause) ? cause.toDisplayMessage() : 'Try again in a moment.',
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleSubmit(rating: number, comment: string): Promise<void> {
    if (rating < MIN_RATING) {
      setNotice({
        tone: 'info',
        title: 'Pick a star rating first',
        body: 'It is the only part we need — the written comment is entirely up to you.',
      });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const payload = { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) };

      if (myReview) await updateReview(myReview.id, payload);
      else await createReview({ movieId, ...payload });

      setIsEditing(false);
      await load();
    } catch (cause) {
      fail(
        'We could not post your review',
        isApiError(cause)
          ? cause.toDisplayMessage()
          : 'Nothing was lost — what you wrote is still in the box. Try again in a moment.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!myReview) return;

    setIsSaving(true);
    setNotice(null);

    try {
      await deleteReview(myReview.id);
      setIsConfirmingDelete(false);
      setIsEditing(false);
      await load();
    } catch (cause) {
      fail(
        'We could not delete your review',
        isApiError(cause) ? cause.toDisplayMessage() : 'It is still there. Try again in a moment.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const total = meta?.totalItems ?? reviews.length;
  const isComposerOpen = canReview && (myReview === undefined || isEditing);

  return (
    <section className="space-y-5" aria-labelledby="reviews-heading">
      <h3 id="reviews-heading" className="text-lg font-bold">
        Reviews{total > 0 ? ` (${total})` : ''}
      </h3>

      {notice ? (
        <FeedbackMessage tone={notice.tone} title={notice.title}>
          {notice.body}
        </FeedbackMessage>
      ) : null}

      {isComposerOpen ? (
        <ReviewComposer
          // Remounting on identity change seeds the inputs from the review
          // without an effect, so the stars are correct on first paint.
          key={myReview?.id ?? 'new'}
          authorName={currentUser?.fullName ?? ''}
          initialRating={myReview?.rating ?? 0}
          initialComment={myReview?.comment ?? ''}
          isExisting={myReview !== undefined}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          {...(isEditing ? { onCancel: () => setIsEditing(false) } : {})}
        />
      ) : canReview ? null : (
        <p className="rounded-sm border border-dashed border-line px-3 py-3 text-sm text-content-muted">
          {currentUser
            ? 'Mark this movie as watched to join the conversation.'
            : 'Sign in and mark this movie as watched to join the conversation.'}
        </p>
      )}

      {isLoading ? (
        <div aria-busy="true" aria-label="Loading reviews" className="space-y-3">
          <div className="h-14 animate-pulse rounded-sm bg-surface-2" />
          <div className="h-14 animate-pulse rounded-sm bg-surface-2" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-content-faint">
          No reviews yet — be the first to say something.
        </p>
      ) : (
        <>
          <ul className="space-y-5">
            {reviews.map((review) => (
              <ReviewThreadItem
                key={review.id}
                review={review}
                isMine={review.userId === currentUser?.id}
                isBusy={isSaving}
                {...(review.id === myReview?.id
                  ? {
                      onEdit: () => {
                        setNotice(null);
                        setIsEditing(true);
                      },
                      onDelete: () => setIsConfirmingDelete(true),
                    }
                  : {})}
              />
            ))}
          </ul>

          {meta?.hasNextPage ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={isLoadingMore}
              className="w-full rounded-sm border border-line-strong py-2 text-sm font-semibold text-content-muted transition-colors hover:border-white hover:text-white disabled:opacity-60"
            >
              {isLoadingMore ? 'Loading…' : `Show earlier reviews (${total - reviews.length} more)`}
            </button>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={isConfirmingDelete}
        title="Delete your review?"
        description="It disappears from this movie's thread and stops counting towards your average rating. You can always write a new one."
        confirmLabel="Delete review"
        busyLabel="Deleting…"
        cancelLabel="Keep it"
        isBusy={isSaving}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!isSaving) setIsConfirmingDelete(false);
        }}
      />
    </section>
  );
}

interface ReviewComposerProps {
  authorName: string;
  initialRating: number;
  initialComment: string;
  isExisting: boolean;
  isSaving: boolean;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  onCancel?: () => void;
}

/** Owns only the draft. Its parent owns the persisted review. */
function ReviewComposer({
  authorName,
  initialRating,
  initialComment,
  isExisting,
  isSaving,
  onSubmit,
  onCancel,
}: ReviewComposerProps): React.JSX.Element {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(rating, comment);
      }}
      className="space-y-3 rounded-sm bg-surface-2 p-4"
    >
      <p className="text-sm font-semibold">
        {isExisting ? 'Editing your review' : `Add your review${authorName ? `, ${authorName}` : ''}`}
      </p>

      <StarRating value={rating} onChange={setRating} />

      <div className="space-y-1">
        <label htmlFor="review-comment" className="block text-xs text-content-muted">
          Comment (optional)
        </label>
        <textarea
          id="review-comment"
          rows={3}
          maxLength={5000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What did you think?"
          className="w-full resize-y rounded-sm border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-content-faint"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : isExisting ? 'Update review' : 'Post review'}
        </button>

        {onCancel ? (
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="rounded-sm border border-line-strong px-4 py-2 text-sm font-semibold text-content-muted transition-colors hover:border-white hover:text-white disabled:opacity-60"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
