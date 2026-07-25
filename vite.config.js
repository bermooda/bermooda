import path from 'path';

import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [reactRouter(), tailwindcss()],
  resolve: {
    alias: {
      '#': path.resolve(__dirname, './app'),
      '#bermooda.config': path.resolve(__dirname, './bermooda.config.js'),
      '#prisma/client': path.resolve(__dirname, './prisma/generated/client'),
    },
  },
});
