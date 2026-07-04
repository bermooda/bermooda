// Client-safe plugin storefront route resolution (mirrors server registry).

const storefrontRouteModules = import.meta.glob(
  '#/plugins/*/storefront/routes.client.js',
  {
    eager: true,
  }
);

/** @type {Map<string, Array<{ path: string, Component: Function }>>} */
const storefrontRoutesByPlugin = new Map();

for (const [modulePath, mod] of Object.entries(storefrontRouteModules)) {
  const match = modulePath.match(
    /\/plugins\/([^/]+)\/storefront\/routes\.client\.js$/
  );
  if (!match) continue;
  const pluginId = match[1];
  const routes = mod.routes ?? mod.default;
  if (Array.isArray(routes)) {
    storefrontRoutesByPlugin.set(pluginId, routes);
  }
}

function normalizePluginRoutePath(path) {
  return String(path ?? '')
    .replace(/^\/+|\/+$/g, '')
    .split('?')[0];
}

export function resolvePluginStorefrontRoute(pluginId, path) {
  const routes = storefrontRoutesByPlugin.get(pluginId);
  if (!routes?.length) return null;

  const normalized = normalizePluginRoutePath(path);

  for (const route of routes) {
    const routePath = normalizePluginRoutePath(route.path);
    if (routePath === normalized) return route;
  }

  if (!normalized && routes[0]) return routes[0];
  return null;
}
