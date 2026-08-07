import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: ['.next/**', 'out/**', 'coverage/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],

      // The app talks to the backend only through `src/lib/api`.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../../*'],
              message: 'Use the `@/` path alias instead of deep relative imports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'src/testing/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
];

export default eslintConfig;
