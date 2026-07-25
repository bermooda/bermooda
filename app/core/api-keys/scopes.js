/**
 * Allowed API key scopes.
 *
 * - `admin` — full Admin API access (recommended for agents / MCP)
 * - `storefront` — reserved for future storefront-scoped credentials
 * - `*:read` / `*:write` — granular Admin API scopes; `admin` implies all of them
 */

export const API_KEY_SCOPES = [
  'admin',
  'storefront',
  'settings:read',
  'settings:write',
  'products:read',
  'products:write',
  'categories:read',
  'categories:write',
  'orders:read',
  'orders:write',
  'media:read',
  'media:write',
  'inventory:read',
  'inventory:write',
  'webhooks:read',
  'webhooks:write',
  'themes:write',
  'plugins:write',
  'audit:read',
  'imports:write',
];

/** Granular scopes that grant access to `/api/admin/v1` (excluding storefront-only). */
export const ADMIN_API_SCOPES = API_KEY_SCOPES.filter(
  (scope) => scope !== 'storefront'
);

/**
 * Whether a key's scopes satisfy a required scope.
 * `admin` satisfies any non-storefront scope.
 *
 * @param {string[]} keyScopes
 * @param {string} requiredScope
 * @returns {boolean}
 */
export function apiKeySatisfiesScope(keyScopes, requiredScope) {
  if (!requiredScope) return true;
  if (keyScopes.includes(requiredScope)) return true;
  if (requiredScope === 'storefront') return false;
  return keyScopes.includes('admin');
}

/**
 * Whether a key may call the Admin API at all.
 *
 * @param {string[]} keyScopes
 * @returns {boolean}
 */
export function apiKeyCanAccessAdminApi(keyScopes) {
  return keyScopes.some((scope) => ADMIN_API_SCOPES.includes(scope));
}
