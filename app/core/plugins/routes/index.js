// Client-safe plugin route resolution helpers.

/**
 * Normalizes a plugin route splat path for comparison.
 *
 * @param {string|null|undefined} path
 * @returns {string}
 */
export function normalizePluginRoutePath(path) {
  return String(path ?? '')
    .replace(/^\/+|\/+$/g, '')
    .split('?')[0];
}

/**
 * Resolves a route descriptor from a plugin route registry.
 *
 * @param {Map<string, Array<{ path?: string }>>} routesByPlugin
 * @param {string} pluginId
 * @param {string|null|undefined} path
 * @returns {{ path?: string }|null}
 */
export function resolvePluginRouteDescriptor(routesByPlugin, pluginId, path) {
  const routes = routesByPlugin.get(pluginId);
  if (!routes?.length) return null;

  const normalized = normalizePluginRoutePath(path);

  for (const route of routes) {
    const routePath = normalizePluginRoutePath(route.path);
    if (routePath === normalized) {
      return route;
    }
  }

  if (!normalized && routes[0]) {
    return routes[0];
  }

  return null;
}

/**
 * Builds a plugin-id → routes map from a Vite glob result.
 *
 * @param {Record<string, { routes?: unknown[], default?: unknown[] }>} modules
 * @param {RegExp} pluginIdPattern
 * @returns {Map<string, Array<{ path?: string }>>}
 */
export function buildPluginRouteRegistry(modules, pluginIdPattern) {
  /** @type {Map<string, Array<{ path?: string }>>} */
  const registry = new Map();

  for (const [modulePath, mod] of Object.entries(modules)) {
    const match = modulePath.match(pluginIdPattern);
    if (!match) continue;

    const pluginId = match[1];
    const routes = mod.routes ?? mod.default;
    if (Array.isArray(routes)) {
      registry.set(pluginId, routes);
    }
  }

  return registry;
}
