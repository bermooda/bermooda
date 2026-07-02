// Client-safe plugin admin route resolution (mirrors server registry).

const adminRouteModules = import.meta.glob(
  '#/plugins/*/admin/routes.client.js',
  {
    eager: true,
  }
);

/** @type {Map<string, Array<{ path: string, Component: Function }>>} */
const adminRoutesByPlugin = new Map();

for (const [modulePath, mod] of Object.entries(adminRouteModules)) {
  const match = modulePath.match(
    /\/plugins\/([^/]+)\/admin\/routes\.client\.js$/
  );
  if (!match) continue;
  const pluginId = match[1];
  const routes = mod.routes ?? mod.default;
  if (Array.isArray(routes)) {
    adminRoutesByPlugin.set(pluginId, routes);
  }
}

export function resolvePluginAdminRoute(pluginId, path) {
  const routes = adminRoutesByPlugin.get(pluginId);
  if (!routes?.length) return null;

  const normalized = String(path ?? '')
    .replace(/^\/+|\/+$/g, '')
    .split('?')[0];

  for (const route of routes) {
    const routePath = String(route.path ?? '').replace(/^\/+|\/+$/g, '');
    if (routePath === normalized) return route;
  }

  if (!normalized && routes[0]) return routes[0];
  return null;
}
