// app/core/marketing/shared.server.js
// Shared helpers for marketing concern modules (not part of the public barrel API).

/**
 * Throw a standardized NOT_FOUND error for a missing entity.
 *
 * @param {string} entity
 * @returns {never}
 */
export function notFound(entity) {
  throw Object.assign(new Error(`${entity} not found`), {
    code: 'NOT_FOUND',
    status: 404,
  });
}
