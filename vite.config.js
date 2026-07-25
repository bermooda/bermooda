import path from 'path';

import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import { resolveDevPort } from './app/core/config/port.js';

const port = resolveDevPort();

export default defineConfig({
  plugins: [reactRouter(), tailwindcss()],
  server: {
    port,
    // Fail loudly if PORT is taken instead of silently binding another port
    // (which would desync config.baseUrl / better-auth trusted origins).
    strictPort: true,
  },
  resolve: {
    alias: {
      '#': path.resolve(__dirname, './app'),
      '#bermooda.config': path.resolve(__dirname, './bermooda.config.js'),
      '#prisma/client': path.resolve(__dirname, './prisma/generated/client'),
    },
  },
});
