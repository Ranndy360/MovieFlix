import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the theme against a failure mode that is silent and very hard to spot.
 *
 * In Tailwind v4 a `--color-<name>` token generates `text-<name>`. If `<name>`
 * matches a built-in utility, the token **shadows** it. That is exactly what
 * `--color-base` did: `text-base` stopped meaning `font-size: 1rem` and started
 * meaning `color: #141414`, so every `md:text-base` element turned near-black
 * on desktop — on a dark UI, invisible. Nothing errors; the CSS is valid.
 */
const THEME = (() => {
  const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');
  const match = /@theme\s*\{([\s\S]*?)\n\}/.exec(css);
  if (!match) throw new Error('No @theme block found in globals.css');
  return match[1] as string;
})();

const colorTokens = (): string[] =>
  [...THEME.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1] as string);

/** Tailwind's font-size scale — the `text-*` namespace these would collide with. */
const FONT_SIZE_SCALE = [
  'xs',
  'sm',
  'base',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
];

/** `font-*` utilities that a `--color-*` token would not touch, but `--font-*` would. */
const FONT_WEIGHT_SCALE = [
  'thin',
  'light',
  'normal',
  'medium',
  'semibold',
  'bold',
  'black',
  'extrabold',
];

describe('theme tokens', () => {
  it('defines at least the core palette', () => {
    const tokens = colorTokens();

    expect(tokens).toEqual(expect.arrayContaining(['canvas', 'surface', 'brand', 'content']));
  });

  it('no colour token shadows a font-size utility', () => {
    const offenders = colorTokens().filter((name) => FONT_SIZE_SCALE.includes(name));

    expect(offenders).toEqual([]);
  });

  it('no colour token shadows a font-weight utility', () => {
    // `--color-black` would turn `font-black` ... still fine, but `text-black`
    // is a real built-in colour and redefining it would be just as confusing.
    const offenders = colorTokens().filter((name) => FONT_WEIGHT_SCALE.includes(name));

    expect(offenders).toEqual([]);
  });

  it('does not redefine Tailwind built-in colour names', () => {
    const builtIns = ['white', 'black', 'transparent', 'current', 'inherit'];
    const offenders = colorTokens().filter((name) => builtIns.includes(name));

    expect(offenders).toEqual([]);
  });

  it('has no duplicate colour token, which would silently win by source order', () => {
    const tokens = colorTokens();
    const duplicates = tokens.filter((name, index) => tokens.indexOf(name) !== index);

    expect(duplicates).toEqual([]);
  });

  it('keeps `base` out of the palette specifically', () => {
    // Regression: this exact token broke `text-base` across the app.
    expect(colorTokens()).not.toContain('base');
  });
});
