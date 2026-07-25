// app/core/api-keys/index.server.js
// API key management: creation, validation, and revocation.
// Keys are displayed once on creation; only the SHA-256 hash is stored.

import { createHash, randomBytes } from 'crypto';

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { parseListPagination } from '#/libs/prisma/pagination/index.server';
import { API_KEY_SCOPES, apiKeySatisfiesScope } from '#/core/api-keys/scopes';

export {
  ADMIN_API_SCOPES,
  API_KEY_SCOPES,
  apiKeyCanAccessAdminApi,
  apiKeySatisfiesScope,
} from '#/core/api-keys/scopes';

export const DEFAULT_API_KEY_LIST_LIMIT = 20;
export const MAX_API_KEY_LIST_RESULTS = 100;

const KEY_PREFIX = 'berm_';
const API_KEY_SCOPE_SET = new Set(API_KEY_SCOPES);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Hash a raw API key using SHA-256.
 * @param {string} rawKey
 * @returns {string}
 */
function hashKey(rawKey) {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Generate a random API key string.
 * @returns {string} e.g. "berm_a1b2c3d4..."
 */
function generateRawKey() {
  return KEY_PREFIX + randomBytes(32).toString('hex');
}

function normalizeScopes(scopes) {
  const normalized = [
    ...new Set(scopes.map((scope) => scope.toString().trim())),
  ];
  if (normalized.length === 0) {
    throw Object.assign(new Error('At least one scope is required'), {
      code: 'SCOPES_REQUIRED',
    });
  }

  const invalid = normalized.filter((scope) => !API_KEY_SCOPE_SET.has(scope));
  if (invalid.length > 0) {
    throw Object.assign(new Error(`Invalid scope: ${invalid.join(', ')}`), {
      code: 'SCOPES_INVALID',
    });
  }

  return normalized;
}

function parseExpiresAt(value) {
  if (value === null || value === undefined || value === '') return null;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw Object.assign(new Error('Invalid expiresAt value'), {
      code: 'EXPIRES_AT_INVALID',
    });
  }

  return parsed;
}

/**
 * Serialize an ApiKey record: drop keyHash, parse scopes, ISO-format dates.
 * @param {object} record
 * @returns {object}
 */
export function serializeApiKey({ keyHash: _kh, scopes, ...rest }) {
  return {
    ...rest,
    scopes: JSON.parse(scopes),
    createdAt: rest.createdAt?.toISOString?.() ?? rest.createdAt,
    updatedAt: rest.updatedAt?.toISOString?.() ?? rest.updatedAt,
    lastUsedAt: rest.lastUsedAt?.toISOString?.() ?? rest.lastUsedAt,
    expiresAt: rest.expiresAt?.toISOString?.() ?? rest.expiresAt,
  };
}

function notFoundError(id) {
  return Object.assign(new Error('API key not found'), {
    code: 'NOT_FOUND',
    status: 404,
    id,
  });
}

async function requireApiKeyRecord(id) {
  const record = await prisma.apiKey.findUnique({ where: { id } });
  if (!record) {
    throw notFoundError(id);
  }
  return record;
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Parse API key list query params.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 */
export function parseApiKeyListParams(source = {}) {
  const { page, limit } = parseListPagination(source, {
    limit: DEFAULT_API_KEY_LIST_LIMIT,
    max: MAX_API_KEY_LIST_RESULTS,
  });

  return { page, limit };
}

/**
 * Parse admin/API create payload into normalized API key fields.
 *
 * @param {object} input
 * @returns {{ label: string, scopes: string[], expiresAt: Date|null }}
 */
export function parseCreateApiKeyInput(input = {}) {
  const label = input.label?.toString().trim() ?? '';
  if (!label) {
    throw Object.assign(new Error('Label is required'), {
      code: 'LABEL_REQUIRED',
    });
  }

  const rawScopes = Array.isArray(input.scopes)
    ? input.scopes
    : input.scopes
      ? [input.scopes]
      : ['admin'];

  const scopes = normalizeScopes(rawScopes);
  const expiresAt = parseExpiresAt(input.expiresAt);

  return { label, scopes, expiresAt };
}

/**
 * Parse admin create-key form data.
 *
 * @param {FormData} formData
 * @returns {{ label: string, scopes: string[], expiresAt: Date|null }}
 */
export function parseCreateApiKeyFormData(formData) {
  const label = formData.get('label')?.toString().trim() ?? '';
  const scopesRaw = formData.getAll('scopes').map(String);
  const scopes = scopesRaw.length > 0 ? scopesRaw : ['admin'];
  const expiresAtRaw = formData.get('expiresAt')?.toString().trim();

  return parseCreateApiKeyInput({
    label,
    scopes,
    ...(expiresAtRaw ? { expiresAt: expiresAtRaw } : {}),
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new API key. Returns the raw key (shown once) plus the stored record.
 * The raw key is never persisted; only its SHA-256 hash is stored.
 *
 * @param {{ label: string, scopes?: string[], expiresAt?: Date }} params
 * @returns {Promise<{ key: string, record: object }>}
 */
export async function createApiKey(params) {
  const { label, scopes, expiresAt } = parseCreateApiKeyInput(params);

  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);

  const record = await prisma.apiKey.create({
    data: {
      label,
      keyHash,
      scopes: JSON.stringify(scopes),
      expiresAt,
    },
  });

  logger.info({ id: record.id, label, scopes }, 'API key created');
  return { key: rawKey, record: serializeApiKey(record) };
}

/**
 * Validate a raw API key and return the stored record.
 * Throws a structured error (with `.status`) on failure.
 * Updates lastUsedAt asynchronously on success.
 *
 * @param {string} rawKey
 * @param {string[]} [requiredScopes]
 * @returns {Promise<object>}
 */
export async function validateApiKey(rawKey, requiredScopes = []) {
  if (!rawKey) {
    throw Object.assign(new Error('API key required'), {
      code: 'KEY_REQUIRED',
      status: 401,
    });
  }

  const keyHash = hashKey(rawKey);
  const record = await prisma.apiKey.findUnique({ where: { keyHash } });

  if (!record) {
    throw Object.assign(new Error('Invalid API key'), {
      code: 'KEY_INVALID',
      status: 401,
    });
  }

  if (record.expiresAt && record.expiresAt < new Date()) {
    throw Object.assign(new Error('API key expired'), {
      code: 'KEY_EXPIRED',
      status: 401,
    });
  }

  const scopes = JSON.parse(record.scopes);
  if (
    requiredScopes.length > 0 &&
    !requiredScopes.every((s) => apiKeySatisfiesScope(scopes, s))
  ) {
    throw Object.assign(new Error('Insufficient scope'), {
      code: 'INSUFFICIENT_SCOPE',
      status: 403,
    });
  }

  // Update lastUsedAt without blocking the caller.
  prisma.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch((err) =>
      logger.error({ err, id: record.id }, 'Failed to update lastUsedAt')
    );

  return serializeApiKey(record);
}

/**
 * List API keys with pagination (keyHash excluded).
 *
 * @param {{ page?: number, limit?: number }} [params]
 * @returns {Promise<{ apiKeys: object[], total: number, page: number, limit: number }>}
 */
export async function listApiKeys(params = {}) {
  const { page, limit } = parseApiKeyListParams(params);
  const skip = (page - 1) * limit;

  const [records, total] = await Promise.all([
    prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.apiKey.count(),
  ]);

  return {
    apiKeys: records.map(serializeApiKey),
    total,
    page,
    limit,
  };
}

/**
 * Get a single API key by id (keyHash excluded).
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getApiKey(id) {
  const record = await requireApiKeyRecord(id);
  return serializeApiKey(record);
}

/**
 * Revoke (permanently delete) an API key by id.
 * @param {string} id
 * @returns {Promise<{ revoked: true }>}
 */
export async function revokeApiKey(id) {
  await requireApiKeyRecord(id);
  await prisma.apiKey.delete({ where: { id } });
  logger.info({ id }, 'API key revoked');
  return { revoked: true };
}
