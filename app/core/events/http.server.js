import { isHookAbort } from '#/core/events/index.server';

/**
 * Map a hook veto error to a JSON response.
 *
 * @param {Error & { reason?: string, code?: string, pluginId?: string | null }} err
 * @returns {Response|null}
 */
export function jsonFromHookAbort(err) {
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
  const hookResponse = jsonFromHookAbort(err);
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
