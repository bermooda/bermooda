// Admin API key middleware for REST API route handlers.

import { createContext } from 'react-router';

import {
  apiKeyCanAccessAdminApi,
  apiKeySatisfiesScope,
  validateApiKey,
} from '#/core/api-keys/index.server';

/**
 * Context object for admin API key middleware.
 *
 * @type {import('react-router').RouterContext<object>}
 */
export const adminApiKeyContext = createContext();

/**
 * Middleware to validate an Admin API key for /api/admin/v1/* routes.
 *
 * Accepts keys with `admin` or any granular admin-area scope.
 * On success, sets `adminApiKeyContext` so child routes can read the key via
 * `context.get(adminApiKeyContext)`.
 *
 * @param {object} context
 * @param {Request} context.request
 * @param {import('react-router').RouterContextProvider} context.context
 */
export async function adminApiKeyMiddleware({ request, context }, next) {
  const apiKey = await requireApiKey(request);
  if (!apiKeyCanAccessAdminApi(apiKey.scopes ?? [])) {
    throw Response.json(
      { error: 'Insufficient scope', code: 'INSUFFICIENT_SCOPE' },
      { status: 403 }
    );
  }
  context.set(adminApiKeyContext, apiKey);
  return next();
}

/**
 * Assert the authenticated API key has a required scope (`admin` satisfies all
 * non-storefront scopes). Call from route loaders/actions after middleware.
 *
 * @param {import('react-router').RouterContextProvider} context
 * @param {string} requiredScope
 */
export function requireAdminApiScope(context, requiredScope) {
  const apiKey = context.get(adminApiKeyContext);
  if (!apiKey || !apiKeySatisfiesScope(apiKey.scopes ?? [], requiredScope)) {
    throw Response.json(
      { error: 'Insufficient scope', code: 'INSUFFICIENT_SCOPE' },
      { status: 403 }
    );
  }
  return apiKey;
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
 * @param {string[]} [requiredScopes] - all listed scopes must be satisfied
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
