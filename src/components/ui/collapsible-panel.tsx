'use client';

import { cn } from '@/lib/utils/cn';

export interface CollapsiblePanelProps {
  open: boolean;
  onToggle: () => void;
  /** Button label when closed. */
  openLabel: string;
  /** Button label when open. */
  closeLabel?: string;
  title: string;
  children: React.ReactNode;
  id: string;
}

/**
 * A form that stays out of the way until asked for.
 *
 * The trigger carries `aria-expanded` and `aria-controls`, so a screen reader
 * announces the state instead of the panel just appearing. The panel is
 * unmounted when closed rather than hidden with CSS, which resets its inputs
 * for free and keeps its fields out of the tab order.
 */
export function CollapsiblePanel({
  open,
  onToggle,
  openLabel,
  closeLabel = 'Cancel',
  title,
  children,
  id,
}: CollapsiblePanelProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className={cn(
            'inline-flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold transition-colors',
            open
              ? 'border border-line-strong text-content-muted hover:border-white hover:text-white'
              : 'bg-brand text-white hover:bg-brand-hover',
          )}
        >
          {open ? (
            closeLabel
          ) : (
            <>
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
              {openLabel}
            </>
          )}
        </button>
      </div>

      {open ? (
        <div id={id} className="rounded-sm border border-line p-5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
