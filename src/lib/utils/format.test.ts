import { formatRating, formatRelativeTime, formatRuntime, initialsOf, truncate } from './format';

describe('formatRuntime', () => {
  it('formats hours and minutes', () => {
    expect(formatRuntime(164)).toBe('2h 44m');
  });

  it('omits the minutes on a whole hour', () => {
    expect(formatRuntime(120)).toBe('2h');
  });

  it('omits the hours below sixty minutes', () => {
    expect(formatRuntime(45)).toBe('45m');
  });

  it('renders a dash for a non-positive or invalid runtime', () => {
    expect(formatRuntime(0)).toBe('—');
    expect(formatRuntime(-10)).toBe('—');
    expect(formatRuntime(Number.NaN)).toBe('—');
  });
});

describe('formatRating', () => {
  it('always shows one decimal place', () => {
    expect(formatRating(8)).toBe('8.0');
    expect(formatRating(7.25)).toBe('7.3');
  });

  it('renders a dash for an invalid rating', () => {
    expect(formatRating(Number.NaN)).toBe('—');
  });
});

describe('truncate', () => {
  it('leaves a short string alone', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('appends an ellipsis when cutting', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });

  it('trims trailing whitespace before the ellipsis', () => {
    expect(truncate('ab   cdefgh', 5)).toBe('ab…');
  });
});

describe('initialsOf', () => {
  it.each([
    ['Grace Hopper', 'GH'],
    ['Ada', 'A'],
    ['ada lovelace king', 'AK'],
    ['  padded  name  ', 'PN'],
  ])('turns %s into %s', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });

  it('never renders an empty circle', () => {
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');
  const ago = (ms: number): string =>
    formatRelativeTime(new Date(now.getTime() - ms).toISOString(), now);

  it('collapses anything under a minute', () => {
    expect(ago(30 * 1000)).toBe('just now');
  });

  it.each([
    [5 * 60 * 1000, /5 minutes ago/],
    [3 * 60 * 60 * 1000, /3 hours ago/],
    [2 * 24 * 60 * 60 * 1000, /2 days ago/],
    [3 * 7 * 24 * 60 * 60 * 1000, /3 weeks ago/],
    [70 * 24 * 60 * 60 * 1000, /2 months ago/],
    [400 * 24 * 60 * 60 * 1000, /1 year ago|last year/],
  ])('reads back %i ms as a human interval', (elapsed, expected) => {
    expect(ago(elapsed)).toMatch(expected);
  });

  it('returns nothing for a value that is not a date', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('');
  });
});
