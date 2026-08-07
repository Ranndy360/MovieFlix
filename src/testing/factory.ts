import { faker } from '@faker-js/faker';

export type FactoryDefinition<T> = (index: number) => T;

/**
 * Minimal object mother, mirroring the one in MovieFlix-api.
 *
 * Every factory returns a *complete, valid* object; a test overrides only the
 * fields it asserts on. That keeps intent visible and stops an added field from
 * breaking dozens of unrelated specs.
 */
export class Factory<T extends object> {
  constructor(private readonly definition: FactoryDefinition<T>) {}

  build(overrides: Partial<T> = {}, index = 0): T {
    return { ...this.definition(index), ...overrides };
  }

  buildMany(count: number, overrides: Partial<T> | ((index: number) => Partial<T>) = {}): T[] {
    return Array.from({ length: count }, (_unused, index) =>
      this.build(typeof overrides === 'function' ? overrides(index) : overrides, index),
    );
  }

  extend(defaults: Partial<T> | ((index: number) => Partial<T>)): Factory<T> {
    return new Factory<T>((index) => ({
      ...this.definition(index),
      ...(typeof defaults === 'function' ? defaults(index) : defaults),
    }));
  }
}

export const defineFactory = <T extends object>(definition: FactoryDefinition<T>): Factory<T> =>
  new Factory<T>(definition);

/** Pins faker's PRNG so a failing test can be replayed exactly. */
export const seedFaker = (seed = 20260101): void => {
  faker.seed(seed);
};
