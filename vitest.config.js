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
          setupFiles: ['./app/test-setup.js'],
          alias: {
            '#': path.resolve('./app'),
            '#bermooda.config': path.resolve('./bermooda.config.js'),
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
          setupFiles: ['./app/test-setup.js'],
          alias: {
            '#': path.resolve('./app'),
            '#bermooda.config': path.resolve('./bermooda.config.js'),
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
