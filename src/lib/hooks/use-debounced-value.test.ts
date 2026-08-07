import { act, renderHook } from '@testing-library/react';

import { useDebouncedValue } from './use-debounced-value';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns the initial value straight away', () => {
    const { result } = renderHook(() => useDebouncedValue('dune', 300));

    expect(result.current).toBe('dune');
  });

  it('holds the new value back until the delay has passed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'd' },
    });

    rerender({ value: 'du' });
    expect(result.current).toBe('d');

    act(() => jest.advanceTimersByTime(299));
    expect(result.current).toBe('d');

    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe('du');
  });

  it('restarts the clock on every keystroke, so only the last one lands', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: '' },
    });

    for (const value of ['d', 'du', 'dun', 'dune']) {
      rerender({ value });
      act(() => jest.advanceTimersByTime(200));
    }

    // 800ms of typing, and the intermediate values never surfaced.
    expect(result.current).toBe('');

    act(() => jest.advanceTimersByTime(300));
    expect(result.current).toBe('dune');
  });
});
