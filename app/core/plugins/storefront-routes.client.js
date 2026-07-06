// Client-safe plugin storefront route resolution (mirrors server registry).

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

export function resolvePluginStorefrontRoute(pluginId, path) {
  return resolvePluginRouteDescriptor(storefrontRoutesByPlugin, pluginId, path);
}
