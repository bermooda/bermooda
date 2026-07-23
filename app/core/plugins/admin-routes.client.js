// Client-safe plugin admin route resolution (mirrors server registry).

import {
  buildPluginRouteRegistry,
  resolvePluginRouteDescriptor,
} from '#/core/plugins/routes/index';

const adminRoutesByPlugin = buildPluginRouteRegistry(
  import.meta.glob('#/plugins/*/admin/routes.client.js', { eager: true }),
  /\/plugins\/([^/]+)\/admin\/routes\.client\.js$/
);

export function resolvePluginAdminRoute(pluginId, path) {
  return resolvePluginRouteDescriptor(adminRoutesByPlugin, pluginId, path);
}
