// app/libs/auth/api/index.server.js
// API key authentication for REST API route handlers.

import { createContext } from 'react-router';

import { validateApiKey } from '#/core/api-keys/index.server';

/**
 * Context object for admin API key middleware.
 *
 * @type {import('react-router').RouterContext<object>}
 */
export const adminApiKeyContext = createContext();

/**
 * Middleware to validate an admin-scoped API key for /api/admin/v1/* routes.
 *
 * On success, sets `adminApiKeyContext` so child routes can read the key via
 * `context.get(adminApiKeyContext)`.
 *
 * @param {object} context
 * @param {Request} context.request
 * @param {import('react-router').RouterContextProvider} context.context
 */
export async function adminApiKeyMiddleware({ request, context }) {
  const apiKey = await requireApiKey(request, ['admin']);
  context.set(adminApiKeyContext, apiKey);
}

/**
 * Extract and validate an API key from the Authorization header.
 *
 * Returns the API key record (without the raw key or hash) on success.
 * Throws a JSON Response on failure.
 *
 * Prefer `adminApiKeyMiddleware` on /api/admin/v1/* routes. Use this directly
 * when middleware is not available.
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
