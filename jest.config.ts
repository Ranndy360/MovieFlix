import type { Config } from 'jest';
import nextJest from 'next/jest.js';

/** `next/jest` wires up SWC, CSS/image stubs and `.env.test` loading. */
const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  // jsdom for components; specs that need real fetch/Headers opt into node
  // with a `@jest-environment node` docblock.
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    // Route files are declarative shells (metadata + composition). Their logic
    // lives in the components they render, which are covered directly.
    '!src/app/**',
    '!src/types/**',
    '!src/testing/**',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  coverageThreshold: {
    global: { branches: 65, functions: 70, lines: 70, statements: 70 },
  },
};

export default createJestConfig(config);
