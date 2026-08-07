'use client';

import { cn } from '@/lib/utils/cn';

export interface SearchInputProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * A labelled search box with a clear button.
 *
 * The label is visually hidden but real: a magnifier glyph is not an
 * accessible name, and a placeholder disappears the moment anyone types. The
 * clear button only exists once there is something to clear, so it never sits
 * there as dead weight.
 */
export function SearchInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  className,
}: SearchInputProps): React.JSX.Element {
  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-faint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.5-3.5" />
        </svg>
      </span>

      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-sm border border-line bg-surface-2 py-2 pl-9 pr-9 text-sm text-white placeholder:text-content-faint focus:border-white"
      />

      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-content-faint transition-colors hover:text-white"
        >
          <span className="sr-only">Clear search</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
