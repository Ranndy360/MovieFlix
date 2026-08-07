'use client';

import type { PaginationMeta } from '@/types/api';

export interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  /** Singular noun for the rows, e.g. "title". Pluralised with a trailing s. */
  itemLabel?: string;
  isBusy?: boolean;
}

/**
 * Page controls with a range summary.
 *
 * "Page 2 of 7" alone leaves the user doing arithmetic to work out whether the
 * thing they want is behind them or ahead; "Showing 21–40 of 137" answers it
 * directly. Both are here because the page number is what the buttons act on.
 */
export function Pagination({
  meta,
  onPageChange,
  itemLabel = 'item',
  isBusy = false,
}: PaginationProps): React.JSX.Element {
  const first = meta.totalItems === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const last = Math.min(meta.page * meta.pageSize, meta.totalItems);
  const noun = meta.totalItems === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-content-muted">
        Showing <span className="font-medium text-white">{first}</span>–
        <span className="font-medium text-white">{last}</span> of{' '}
        <span className="font-medium text-white">{meta.totalItems}</span> {noun}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!meta.hasPreviousPage || isBusy}
          onClick={() => onPageChange(meta.page - 1)}
          className="rounded-sm border border-line-strong px-3 py-1.5 text-sm font-medium transition-colors hover:border-white disabled:opacity-40 disabled:hover:border-line-strong"
        >
          Previous
        </button>

        <span className="px-1 text-sm text-content-muted">
          Page {meta.page} of {Math.max(meta.totalPages, 1)}
        </span>

        <button
          type="button"
          disabled={!meta.hasNextPage || isBusy}
          onClick={() => onPageChange(meta.page + 1)}
          className="rounded-sm border border-line-strong px-3 py-1.5 text-sm font-medium transition-colors hover:border-white disabled:opacity-40 disabled:hover:border-line-strong"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
