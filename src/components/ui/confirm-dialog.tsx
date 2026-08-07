'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils/cn';
import { FeedbackMessage } from './feedback-message';

export interface ConfirmDialogProps {
  open: boolean;
  /** Short and specific — name the thing, not the operation. */
  title: string;
  description: React.ReactNode;
  /** Rendered between the copy and the buttons: a poster, a summary, a diff. */
  preview?: React.ReactNode;
  confirmLabel?: string;
  /** Shown on the confirm button while the action is in flight. */
  busyLabel?: string;
  cancelLabel?: string;
  isBusy?: boolean;
  /** Failures belong *inside* the dialog — behind it the user cannot read them. */
  error?: string | null;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation modal for actions the user cannot undo.
 *
 * Built on the native `<dialog>`, like `MovieDetailDialog`: `showModal()` gives
 * focus trapping, Escape-to-close, page inertness and top-layer stacking for
 * free. What this adds over `window.confirm` is everything the platform dialog
 * cannot do — it renders the artwork so the user sees *which* row they are
 * about to destroy, it stays open while the request is in flight, and it shows
 * the failure in place instead of behind the modal.
 *
 * Cancel takes focus on open. The destructive button is one Tab away on
 * purpose: the safe choice should be the one Enter picks.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  preview,
  confirmLabel = 'Confirm',
  busyLabel = 'Working…',
  cancelLabel = 'Cancel',
  isBusy = false,
  error = null,
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  /** Set while *we* close the dialog, so the resulting `close` event is not
   *  mistaken for the user dismissing it. */
  const closingRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else if (!open && dialog.open) {
      closingRef.current = true;
      dialog.close();
      closingRef.current = false;
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const isDanger = tone === 'danger';

  return (
    <dialog
      ref={dialogRef}
      data-confirm
      role="alertdialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      onCancel={(event) => {
        // Escape must not abandon a request that is already on its way.
        if (isBusy) event.preventDefault();
      }}
      onClose={() => {
        if (!closingRef.current) onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && !isBusy) onCancel();
      }}
      className="w-[calc(100vw-2rem)] max-w-md rounded-lg border border-line bg-surface p-0 text-content shadow-2xl"
    >
      <div className="p-6">
        <div className="flex gap-4">
          <span
            aria-hidden="true"
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full',
              isDanger ? 'bg-brand/15 text-brand' : 'bg-surface-3 text-content-muted',
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>

          <div className="min-w-0 space-y-1">
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-white">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="text-sm text-content-muted">
              {description}
            </p>
          </div>
        </div>

        {preview ? <div className="mt-5">{preview}</div> : null}

        {error ? (
          <FeedbackMessage tone="error" title="That did not work" className="mt-5">
            {error}
          </FeedbackMessage>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-line bg-surface-2 px-6 py-4 sm:flex-row sm:justify-end">
        <button
          ref={cancelRef}
          type="button"
          disabled={isBusy}
          onClick={onCancel}
          className="rounded-sm border border-line-strong px-4 py-2 text-sm font-medium transition-colors hover:border-white disabled:opacity-40"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={onConfirm}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60',
            isDanger ? 'bg-brand hover:bg-brand-hover' : 'bg-surface-3 hover:bg-line-strong',
          )}
        >
          {isBusy ? (
            <>
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
              {busyLabel}
            </>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </dialog>
  );
}
