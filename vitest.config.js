import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'happy-dom',
          globals: true,
          include: ['app/**/*.test.jsx', 'app/**/*.test.js'],
          exclude: [
            'app/**/*.test.server.js',
            'app/**/*.test.server.jsx',
            'app/routes/**/*.test.jsx',
          ],
          setupFiles: ['./vitest-setup.js'],
          alias: {
            '#': path.resolve('./app'),
            '#prisma/client': path.resolve('./prisma/generated/client'),
          },
        },
      },
      {
        test: {
          name: 'server',
          environment: 'node',
          globals: true,
          include: [
            'app/**/*.test.server.js',
            'app/**/*.test.server.jsx',
            'app/routes/**/*.test.jsx',
          ],
          setupFiles: ['./vitest-setup.js'],
          alias: {
            '#': path.resolve('./app'),
            '#prisma/client': path.resolve('./prisma/generated/client'),
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['app/core/**'],
      thresholds: {
        'app/core/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
