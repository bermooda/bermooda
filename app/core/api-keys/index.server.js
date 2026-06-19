// app/core/api-keys/index.server.js
// API key management: creation, validation, and revocation.
// Keys are displayed once on creation; only the SHA-256 hash is stored.

import { createHash, randomBytes } from 'crypto';

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

const KEY_PREFIX = 'berm_';
const MAX_LIST_RESULTS = 100;

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

/**
 * Serialize an ApiKey record: drop keyHash, parse scopes, ISO-format dates.
 * @param {object} record
 * @returns {object}
 */
function serializeApiKey({ keyHash: _kh, scopes, ...rest }) {
  return {
    ...rest,
    scopes: JSON.parse(scopes),
    createdAt: rest.createdAt?.toISOString?.() ?? rest.createdAt,
    updatedAt: rest.updatedAt?.toISOString?.() ?? rest.updatedAt,
    lastUsedAt: rest.lastUsedAt?.toISOString?.() ?? rest.lastUsedAt,
    expiresAt: rest.expiresAt?.toISOString?.() ?? rest.expiresAt,
  };
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
export async function createApiKey({ label, scopes = ['admin'], expiresAt }) {
  if (!label?.trim()) {
    throw Object.assign(new Error('Label is required'), {
      code: 'LABEL_REQUIRED',
    });
  }
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw Object.assign(new Error('At least one scope is required'), {
      code: 'SCOPES_REQUIRED',
    });
  }

  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);

  const record = await prisma.apiKey.create({
    data: {
      label: label.trim(),
      keyHash,
      scopes: JSON.stringify(scopes),
      expiresAt: expiresAt ?? null,
    },
  });

  logger.info(
    { id: record.id, label: record.label, scopes },
    'API key created'
  );
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
    !requiredScopes.every((s) => scopes.includes(s))
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
 * List all API keys (keyHash excluded).
 * @returns {Promise<object[]>}
 */
export async function listApiKeys() {
  const records = await prisma.apiKey.findMany({
    orderBy: { createdAt: 'desc' },
    take: MAX_LIST_RESULTS,
  });
  return records.map(serializeApiKey);
}

/**
 * Get a single API key by id (keyHash excluded).
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getApiKey(id) {
  const record = await prisma.apiKey.findUnique({ where: { id } });
  if (!record) {
    throw Object.assign(new Error('API key not found'), {
      code: 'KEY_NOT_FOUND',
      status: 404,
    });
  }
  return serializeApiKey(record);
}

/**
 * Revoke (permanently delete) an API key by id.
 * @param {string} id
 */
export async function revokeApiKey(id) {
  await prisma.apiKey.delete({ where: { id } });
  logger.info({ id }, 'API key revoked');
}
