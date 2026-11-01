import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Rutas con fileURLToPath: la carpeta del proyecto contiene "&" (C&C) y URL.pathname la codifica.
const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          root: root('./backend/shared'),
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'worker',
          root: root('./backend/worker'),
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'web',
          root: root('./frontend'),
          include: ['**/*.test.ts'],
          exclude: ['node_modules/**', '.next/**'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          root: root('./tests/integration'),
          include: ['**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
