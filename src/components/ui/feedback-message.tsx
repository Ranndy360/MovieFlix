'use client';

import { cn } from '@/lib/utils/cn';

export type FeedbackTone = 'success' | 'error' | 'info';

export interface FeedbackMessageProps {
  tone: FeedbackTone;
  /** The headline: what happened, in the user's terms. */
  title?: string;
  /** What it means or what to do next. Optional — some messages are one line. */
  children?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const TONE_STYLES: Record<FeedbackTone, { box: string; icon: string; title: string }> = {
  success: {
    box: 'border-success/30 bg-success/10',
    icon: 'bg-success/20 text-success',
    title: 'text-success',
  },
  error: {
    box: 'border-brand/40 bg-brand/10',
    icon: 'bg-brand/20 text-brand',
    title: 'text-white',
  },
  info: {
    box: 'border-line bg-surface-2',
    icon: 'bg-surface-3 text-content-muted',
    title: 'text-white',
  },
};

const ICON_PATHS: Record<FeedbackTone, string> = {
  success: 'm5 13 4 4L19 7',
  error: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};

/**
 * The one way this app talks back to the user.
 *
 * Every message used to be its own `<p role="alert">` with its own padding and
 * its own shade of red, and the copy was whatever fit on one line — "Updated
 * “Dune”." tells you the request returned 200 and nothing a person actually
 * wants to know. The shape here pushes for better: a `title` saying what
 * happened and a body saying what it means or what to do next.
 *
 * Errors get `role="alert"` so a screen reader interrupts; everything else gets
 * `role="status"`, which waits for a pause. Announcing a success as urgently as
 * a failure is how a screen reader turns into noise.
 */
export function FeedbackMessage({
  tone,
  title,
  children,
  onDismiss,
  className,
}: FeedbackMessageProps): React.JSX.Element {
  const styles = TONE_STYLES[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-sm border px-4 py-3 text-sm', styles.box, className)}
    >
      <span
        aria-hidden="true"
        className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full', styles.icon)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[tone]} />
        </svg>
      </span>

      <div className="min-w-0 flex-1 space-y-0.5">
        {title ? <p className={cn('font-semibold', styles.title)}>{title}</p> : null}
        {children ? <p className="text-content-muted">{children}</p> : null}
      </div>

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="-mr-1 -mt-1 h-fit rounded-sm p-1 text-content-faint transition-colors hover:text-white"
        >
          <span className="sr-only">Dismiss</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
