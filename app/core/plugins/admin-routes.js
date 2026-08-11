// Isomorphic plugin admin route resolution (mirrors server registry).
//
// Do not name this `*.client.js`: React Router's Vite plugin stubs every
// `*.client.js` export to `undefined` during SSR, which breaks the admin
// plugin dispatcher when it resolves Components while rendering.

import {
  buildPluginRouteRegistry,
  resolvePluginRouteDescriptor,
} from '#/core/plugins/routes';

const adminRoutesByPlugin = buildPluginRouteRegistry(
  import.meta.glob('#/plugins/*/admin/routes.client.js', { eager: true }),
  /\/plugins\/([^/]+)\/admin\/routes\.client\.js$/
);

/**
 * Resolves an admin route descriptor for a plugin folder slug.
 *
 * @param {string} pluginId
 * @param {string|null|undefined} path - splat path without leading slash
 * @returns {(Record<string, unknown> & { params: Record<string, string> }) | null}
 */
export function resolvePluginAdminRoute(pluginId, path) {
  return resolvePluginRouteDescriptor(adminRoutesByPlugin, pluginId, path);
}
