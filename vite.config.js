import path from 'path';
import { fileURLToPath } from 'url';

import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import { collectExtensionRuntimeDependencyNames } from './app/core/extensions/deps.js';
import { resolveDevPort } from './app/libs/config/port.js';
import { syncExtensionTwSources } from './scripts/sync-extension-tw-sources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = resolveDevPort();

/**
 * Theme/plugin packages may ship deps only under
 * `app/{themes,plugins}/<slug>/node_modules`. Vite's SSR default externalizes
 * `node_modules`, and the server runtime resolves from `build/server/` (shop
 * root) — so nested extension deps must be forced into the server bundle.
 */
const extensionNoExternal = collectExtensionRuntimeDependencyNames(
  path.resolve(__dirname, 'app')
);

/**
 * Keep Tailwind's extension scan cache in sync before CSS is compiled.
 * See scripts/sync-extension-tw-sources.mjs.
 *
 * @returns {import('vite').Plugin}
 */
function extensionTwSourcesPlugin() {
  return {
    name: 'bermooda-extension-tw-sources',
    buildStart() {
      syncExtensionTwSources();
    },
    configureServer() {
      syncExtensionTwSources();
    },
  };
}

export default defineConfig({
  plugins: [extensionTwSourcesPlugin(), reactRouter(), tailwindcss()],
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
    // Prefer the shop's React when themes/plugins also nest a copy via peers.
    dedupe: ['react', 'react-dom', 'react-router', 'react-router/dom'],
  },
  ssr: {
    noExternal: extensionNoExternal,
  },
});
