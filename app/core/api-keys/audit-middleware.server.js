// Middleware that records Admin API mutations (non-GET) to the audit log.
// Actor is the authenticated API key (`actorType: api_key`).

import logger from '#/utils/logger.server';
import { adminApiKeyContext } from '#/core/api-keys/middleware.server';
import { recordApiKeyAudit } from '#/core/audit/index.server';

/**
 * @param {string} pathname
 * @returns {{ entityType: string|null, entityId: string|null }}
 */
function entityFromPath(pathname) {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  // .../api/admin/v1/<resource>/:id?...
  const v1Index = parts.findIndex(
    (part, index) => part === 'v1' && parts[index - 1] === 'admin'
  );
  if (v1Index < 0 || !parts[v1Index + 1]) {
    return { entityType: null, entityId: null };
  }
  const entityType = parts[v1Index + 1];
  const maybeId = parts[v1Index + 2];
  const entityId =
    maybeId && !['levels', 'locations'].includes(entityType)
      ? maybeId
      : (maybeId ?? null);
  return { entityType, entityId };
}

/**
 * React Router middleware: after a successful mutating Admin API response,
 * write an audit log entry for the API key.
 *
 * @param {object} args
 * @param {Request} args.request
 * @param {import('react-router').RouterContextProvider} args.context
 * @param {() => Promise<Response|void>} next
 */
export async function adminApiAuditMiddleware({ request, context }, next) {
  const response = await next();
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return response;
  }
  if (!response || response.status >= 400) {
    return response;
  }

  try {
    const apiKey = context.get(adminApiKeyContext);
    if (!apiKey?.id) return response;

    const url = new URL(request.url);
    const { entityType, entityId } = entityFromPath(url.pathname);
    await recordApiKeyAudit({
      apiKey,
      action: `api.${method.toLowerCase()}.${entityType ?? 'unknown'}`,
      entityType,
      entityId,
      metadata: {
        method,
        path: url.pathname,
        status: response.status,
      },
    });
  } catch (err) {
    logger.warn({ err }, 'adminApiAuditMiddleware: failed to record audit');
  }

  return response;
}
