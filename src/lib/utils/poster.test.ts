import { posterGradient, posterInitials } from './poster';

describe('posterGradient', () => {
  it('is deterministic for the same movie', () => {
    expect(posterGradient('Dune', 'SCI_FI')).toBe(posterGradient('Dune', 'SCI_FI'));
  });

  it('differs by genre', () => {
    expect(posterGradient('Dune', 'SCI_FI')).not.toBe(posterGradient('Dune', 'HORROR'));
  });

  it('varies the angle by title, so a genre row is not uniform', () => {
    expect(posterGradient('Dune', 'SCI_FI')).not.toBe(posterGradient('Arrival', 'SCI_FI'));
  });

  it('produces a usable CSS gradient', () => {
    expect(posterGradient('Dune', 'SCI_FI')).toMatch(/^linear-gradient\(\d+deg, #[0-9a-f]{6} 0%, #[0-9a-f]{6} 100%\)$/);
  });
});

describe('posterInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(posterInitials('Blade Runner')).toBe('BR');
  });

  it('takes two letters from a single word', () => {
    expect(posterInitials('Arrival')).toBe('AR');
  });

  it('ignores punctuation', () => {
    expect(posterInitials('Spider-Man: Homecoming')).toBe('SH');
  });

  it('handles a numeric title', () => {
    expect(posterInitials('1917')).toBe('19');
  });

  it('falls back for an empty title', () => {
    expect(posterInitials('')).toBe('?');
    expect(posterInitials('!!!')).toBe('?');
  });
});
