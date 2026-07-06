// app/libs/auth/api.server.js
// API key authentication for REST API route handlers.
// Usage: const apiKey = await requireApiKey(request, ['admin']);

import { enforceRateLimit } from '#/libs/rate-limit.server';
import { validateApiKey } from '#/core/api-keys/index.server';

/**
 * Extract and validate an API key from the Authorization header.
 *
 * Returns the API key record (without the raw key or hash) on success.
 * Throws a JSON Response on failure so route handlers can propagate it with:
 *
 *   export async function loader({ request }) {
 *     const apiKey = await requireApiKey(request, ['admin']);
 *     ...
 *   }
 *
 * Rate limiting is enforced by the parent API layout loaders.
 *
 * @param {Request} request
 * @param {string[]} [requiredScopes] - all listed scopes must be present
 * @returns {Promise<object>} ApiKey record
 */
export async function requireApiKey(request, requiredScopes = []) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const rawKey = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  try {
    return await validateApiKey(rawKey, requiredScopes);
  } catch (err) {
    throw Response.json(
      { error: err.message, code: err.code ?? 'UNAUTHORIZED' },
      { status: err.status ?? 401 }
    );
  }
}

/**
 * Enforce public API rate limits for unauthenticated storefront endpoints.
 *
 * @param {Request} request
 */
export function enforcePublicApiRateLimit(request) {
  enforceRateLimit(request, 'api-public');
}
