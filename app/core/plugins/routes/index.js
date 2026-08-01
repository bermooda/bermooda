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
 * @typedef {{ path?: string, params: Record<string, string> }} PluginRouteMatch
 */

/**
 * Tries to match a registered pattern against a normalized request path.
 * Supports `:name` segment captures and a trailing `*` splat (captured as `splat`).
 *
 * @param {string} pattern
 * @param {string} path
 * @returns {Record<string, string>|null}
 */
function matchPluginRoutePattern(pattern, path) {
  const patternParts = pattern === '' ? [] : pattern.split('/');
  const pathParts = path === '' ? [] : path.split('/');

  /** @type {Record<string, string>} */
  const params = {};
  let patternIndex = 0;
  let pathIndex = 0;

  while (patternIndex < patternParts.length) {
    const part = patternParts[patternIndex];

    if (part === '*') {
      // Trailing splat only — must be the last pattern segment.
      if (patternIndex !== patternParts.length - 1) {
        return null;
      }
      params.splat = pathParts.slice(pathIndex).join('/');
      return params;
    }

    if (pathIndex >= pathParts.length) {
      return null;
    }

    const value = pathParts[pathIndex];
    if (part.startsWith(':') && part.length > 1) {
      params[part.slice(1)] = value;
    } else if (part !== value) {
      return null;
    }

    patternIndex += 1;
    pathIndex += 1;
  }

  if (pathIndex !== pathParts.length) {
    return null;
  }

  return params;
}

/**
 * Resolves a route descriptor from a plugin route registry.
 * Exact path matches win; otherwise the first registered `:param` / trailing `*`
 * pattern that matches is used (registration order).
 *
 * @param {Map<string, Array<{ path?: string }>>} routesByPlugin
 * @param {string} pluginId
 * @param {string|null|undefined} path
 * @returns {(Record<string, unknown> & PluginRouteMatch)|null}
 */
export function resolvePluginRouteDescriptor(routesByPlugin, pluginId, path) {
  const routes = routesByPlugin.get(pluginId);
  if (!routes?.length) return null;

  const normalized = normalizePluginRoutePath(path);

  for (const route of routes) {
    const routePath = normalizePluginRoutePath(route.path);
    if (routePath === normalized) {
      return { ...route, params: {} };
    }
  }

  for (const route of routes) {
    const routePath = normalizePluginRoutePath(route.path);
    const matchedParams = matchPluginRoutePattern(routePath, normalized);
    if (matchedParams) {
      return { ...route, params: matchedParams };
    }
  }

  if (!normalized && routes[0]) {
    return { ...routes[0], params: {} };
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
