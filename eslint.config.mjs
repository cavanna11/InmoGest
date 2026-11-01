import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    settings: {
      // La app Next.js vive en frontend/ (ADR 0001).
      next: { rootDir: 'frontend/' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Scripts de línea de comandos y el logger del worker escriben en la consola a propósito.
    files: ['scripts/**', 'backend/worker/src/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  globalIgnores([
    '**/.next/**',
    '**/dist/**',
    '**/out/**',
    '**/build/**',
    '**/coverage/**',
    '**/node_modules/**',
    'frontend/next-env.d.ts',
    'backend/supabase/.temp/**',
    'backend/shared/src/database.types.ts',
    'playwright-report/**',
    'test-results/**',
  ]),
]);
