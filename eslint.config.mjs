import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

/**
 * ESLint flat config (ESLint 9). `eslint-config-next` is still expressed in the
 * legacy eslintrc format, so we bridge it into flat config with FlatCompat.
 *
 * `next/core-web-vitals` + `next/typescript` are the two rule sets create-next-app
 * ships for the App Router + TypeScript. Lint is a real CI gate (see
 * .github/workflows/ci.yml) — it is not allowed to soft-fail.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default eslintConfig;
