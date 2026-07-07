// Shared helpers for admin HTML route modules (/admin/*).

import logger from '#/utils/logger.server';
import { sendErrorAlert } from '#/libs/alerting.server';
import { buildHandleErrorAlert } from '#/libs/alerting/shared.server';
import { parseListPagination } from '#/libs/prisma/pagination.server';

/**
 * Parse page/limit from admin list query params.
 *
 * @param {URLSearchParams} searchParams
 * @param {{ limit?: number, max?: number }} [defaults]
 * @returns {{ page: number, limit: number }}
 */
export function parseAdminUiPagination(searchParams, defaults = {}) {
  return parseListPagination(searchParams, defaults);
}

/**
 * Parse common admin list/search query params.
 *
 * @param {URLSearchParams} searchParams
 * @param {{ limit?: number, max?: number }} [defaults]
 * @returns {{ page: number, limit: number, q: string, status?: string }}
 */
export function parseAdminSearchParams(searchParams, defaults = {}) {
  const { page, limit } = parseAdminUiPagination(searchParams, defaults);
  const q = searchParams.get('q')?.trim() ?? '';
  const status = searchParams.get('status')?.trim() || undefined;

  return { page, limit, q, status };
}

/**
 * Map a domain error to an admin action payload.
 *
 * @param {Error & { code?: string }} err
 * @param {{
 *   source: string,
 *   knownCodes?: Record<string, object>,
 *   userMessage?: string,
 *   shape?: 'ok' | 'error',
 *   intent?: string,
 * }} opts
 * @returns {object}
 */
export function handleAdminActionError(
  err,
  { source, knownCodes = {}, userMessage, shape = 'ok', intent } = {}
) {
  if (err instanceof Response) {
    throw err;
  }

  for (const [code, payload] of Object.entries(knownCodes)) {
    if (err?.code === code || err?.message === code) {
      return intent !== undefined ? { ...payload, intent } : payload;
    }
  }

  if (err?.code === 'P2002') {
    const duplicate =
      shape === 'error'
        ? { error: 'A record with that value already exists.' }
        : { ok: false, error: 'A record with that value already exists.' };
    return intent !== undefined ? { ...duplicate, intent } : duplicate;
  }

  const resolvedMessage =
    userMessage ||
    (err instanceof Error ? err.message : undefined) ||
    'Something went wrong';

  logger.error(err, resolvedMessage);
  sendErrorAlert(
    buildHandleErrorAlert(err, {
      message: resolvedMessage,
      source,
    })
  );

  if (shape === 'error') {
    return { error: resolvedMessage };
  }

  return {
    ok: false,
    error: resolvedMessage,
    ...(intent !== undefined ? { intent } : {}),
  };
}
