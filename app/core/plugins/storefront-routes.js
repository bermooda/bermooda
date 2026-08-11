// Isomorphic plugin storefront route resolution (mirrors server registry).
//
// Do not name this `*.client.js`: React Router's Vite plugin stubs every
// `*.client.js` export to `undefined` during SSR, which breaks the apps
// dispatcher when it resolves Components while rendering.

import {
  buildPluginRouteRegistry,
  resolvePluginRouteDescriptor,
} from '#/core/plugins/routes';

const storefrontRoutesByPlugin = buildPluginRouteRegistry(
  import.meta.glob('#/plugins/*/storefront/routes.client.js', {
    eager: true,
  }),
  /\/plugins\/([^/]+)\/storefront\/routes\.client\.js$/
);

/**
 * Resolves a storefront route descriptor for a plugin folder slug.
 *
 * @param {string} pluginId
 * @param {string|null|undefined} path - splat path without leading slash
 * @returns {(Record<string, unknown> & { params: Record<string, string> }) | null}
 */
export function resolvePluginStorefrontRoute(pluginId, path) {
  return resolvePluginRouteDescriptor(
    storefrontRoutesByPlugin,
    pluginId,
    path
  );
}
