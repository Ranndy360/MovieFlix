'use client';

import { useEffect, useState } from 'react';

/**
 * Trails `value` by `delayMs`, resetting the clock on every change.
 *
 * Search boxes drive server requests, and firing one per keystroke means the
 * user pays for eight round trips to type "avengers" — of which only the last
 * matters, and which can land out of order. Debouncing the *value* rather than
 * the request keeps the input itself instant: the user sees every character as
 * they type it, and only the query lags behind.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
