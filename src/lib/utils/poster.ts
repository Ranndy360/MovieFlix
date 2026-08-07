import type { MovieGenre } from '@/types/api';

/**
 * Artwork fallbacks.
 *
 * Most catalog rows will have a `posterUrl`, but some will not, and a broken
 * image icon destroys the illusion instantly. Rather than a grey box, a movie
 * without artwork gets a deterministic gradient keyed to its genre and title —
 * the same movie always renders the same tile, so the grid looks designed
 * rather than degraded.
 */

const GENRE_GRADIENTS: Record<MovieGenre, [string, string]> = {
  ACTION: ['#7f1d1d', '#450a0a'],
  ADVENTURE: ['#78350f', '#431407'],
  ANIMATION: ['#5b21b6', '#2e1065'],
  COMEDY: ['#a16207', '#422006'],
  DOCUMENTARY: ['#115e59', '#042f2e'],
  DRAMA: ['#1e3a8a', '#172554'],
  HORROR: ['#1c1917', '#000000'],
  ROMANCE: ['#9d174d', '#4c0519'],
  SCI_FI: ['#0e7490', '#083344'],
  THRILLER: ['#3730a3', '#1e1b4b'],
};

/** Stable 32-bit hash — same input, same tilt, across renders and reloads. */
function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result << 5) - result + value.charCodeAt(index);
    result |= 0;
  }
  return Math.abs(result);
}

export function posterGradient(title: string, genre: MovieGenre): string {
  const [from, to] = GENRE_GRADIENTS[genre] ?? GENRE_GRADIENTS.DRAMA;
  const angle = 120 + (hash(title) % 90);

  return `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`;
}

/** Up to two letters, for the centre of a fallback tile. */
export function posterInitials(title: string): string {
  const words = title
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();

  return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase();
}
