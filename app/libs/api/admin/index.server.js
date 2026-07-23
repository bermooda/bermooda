// Shared helpers for authenticated admin REST API routes (/api/admin/v1/*).

import { parseListPagination } from '#/libs/prisma/pagination/index.server';
import { isHookAbort } from '#/core/events/index.server';

export {
  cartNotFoundResponse,
  jsonDomainError,
  methodNotAllowedResponse,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/public/index.server';

/**
 * Return a 405 response when the request method is not in the allowed set.
 *
 * @param {Request} request
 * @param {string[]} methods
 * @returns {Response|null}
 */
export function requireOneOfMethods(request, methods) {
  if (!methods.includes(request.method)) {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  return null;
}

/**
 * Parse a JSON request body, allowing empty bodies.
 *
 * @param {Request} request
 * @param {{ defaultValue?: object, invalidMessage?: string }} [opts]
 * @returns {Promise<{ body: object } | { error: Response }>}
 */
export async function parseOptionalJsonBody(
  request,
  { defaultValue = {}, invalidMessage = 'Invalid JSON body' } = {}
) {
  try {
    if (request.headers.get('content-length') === '0') {
      return { body: defaultValue };
    }
    const body = await request.json();
    return { body: body ?? defaultValue };
  } catch {
    return { error: Response.json({ error: invalidMessage }, { status: 400 }) };
  }
}

/**
 * Parse a boolean query param when present.
 *
 * @param {URLSearchParams} searchParams
 * @param {string} key
 * @returns {boolean|undefined}
 */
export function parseBooleanQueryParam(searchParams, key) {
  if (!searchParams.has(key)) return undefined;
  return searchParams.get(key) === 'true';
}

/**
 * Parse page/limit from admin list query params.
 *
 * @param {URLSearchParams} searchParams
 * @param {{ limit?: number, max?: number }} [defaults]
 * @returns {{ page: number, limit: number }}
 */
export function parseAdminListPagination(searchParams, defaults = {}) {
  return parseListPagination(searchParams, defaults);
}

/**
 * Build a standard paginated list JSON response.
 *
 * @param {string} resourceKey
 * @param {{ items: unknown[], total: number, page: number, limit: number, extra?: object }}
 * @returns {Response}
 */
export function jsonListResponse(
  resourceKey,
  { items, total, page, limit, extra = {} }
) {
  return Response.json({
    [resourceKey]: items,
    total,
    page,
    limit,
    ...extra,
  });
}

/**
 * Return a resource JSON payload or a 404 when the resource is missing.
 *
 * @param {string} resourceKey
 * @param {unknown|null|undefined} resource
 * @param {{ message?: string, code?: string }} [opts]
 * @returns {Response}
 */
export function jsonResourceOr404(
  resourceKey,
  resource,
  { message, code } = {}
) {
  if (!resource) {
    const label = resourceKey
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase();
    return Response.json(
      {
        error:
          message ??
          `${label.charAt(0).toUpperCase()}${label.slice(1)} not found`,
        code: code ?? 'NOT_FOUND',
      },
      { status: 404 }
    );
  }

  return Response.json({ [resourceKey]: resource });
}

/**
 * Map a domain error code to an HTTP status and JSON payload.
 *
 * @param {{
 *   notFound?: string[],
 *   badRequest?: string[],
 *   conflict?: string[],
 *   defaultStatus?: number,
 * }} [config]
 * @returns {(err: Error & { code?: string, status?: number }) => Response}
 */
export function createDomainErrorMapper({
  notFound = [],
  badRequest = [],
  conflict = [],
  defaultStatus = 422,
} = {}) {
  const notFoundCodes = new Set(notFound);
  const badRequestCodes = new Set(badRequest);
  const conflictCodes = new Set(conflict);

  return function mapDomainError(err) {
    let status = err.status ?? defaultStatus;

    if (notFoundCodes.has(err.code)) {
      status = 404;
    } else if (badRequestCodes.has(err.code)) {
      status = 400;
    } else if (conflictCodes.has(err.code)) {
      status = 409;
    }

    return Response.json({ error: err.message, code: err.code }, { status });
  };
}

/**
 * Map a hook veto error to a JSON response.
 *
 * @param {Error & { reason?: string, code?: string, pluginId?: string | null }} err
 * @returns {Response|null}
 */
export function jsonHookAbortError(err) {
  if (!isHookAbort(err)) {
    return null;
  }

  return Response.json(
    {
      error: err.reason,
      code: err.code,
      blockedBy: err.pluginId,
    },
    { status: 422 }
  );
}

/**
 * Map a domain or hook error to a JSON response.
 *
 * @param {Error & { code?: string, status?: number, reason?: string, pluginId?: string | null }} err
 * @param {(err: Error & { code?: string, status?: number }) => Response} [mapDomainError]
 * @returns {Response}
 */
export function jsonActionError(err, mapDomainError) {
  const hookResponse = jsonHookAbortError(err);
  if (hookResponse) {
    return hookResponse;
  }

  if (mapDomainError) {
    return mapDomainError(err);
  }

  return Response.json(
    { error: err.message, code: err.code },
    { status: err.status ?? 422 }
  );
}
