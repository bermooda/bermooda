// app/core/setup/index.server.js
// Machine-friendly shop bootstrap: status, first admin, first API key.
// Complements UI onboarding and CLI seed — used by agents and post-install tooling.

import { timingSafeEqual } from 'crypto';

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import {
  createFirstAdmin,
  isOnboardingAvailable,
  mapOnboardingActionError,
  validateOnboardingInput,
} from '#/core/admin-onboarding/index.server';
import { createApiKey, listApiKeys } from '#/core/api-keys/index.server';
import { SETTING_KEYS } from '#/core/settings/keys';

export const SETUP_TOKEN_ENV = 'SETUP_TOKEN';
export const BOOTSTRAP_API_KEY_LABEL = 'bootstrap';

/**
 * @typedef {{
 *   onboardingAvailable: boolean,
 *   adminExists: boolean,
 *   adminSetupComplete: boolean,
 *   apiKeyCount: number,
 *   bootstrapApiKeyAvailable: boolean,
 *   setupTokenConfigured: boolean,
 * }} SetupStatus
 */

/**
 * @returns {string}
 */
function readConfiguredSetupToken() {
  return process.env[SETUP_TOKEN_ENV]?.trim() ?? '';
}

/**
 * Constant-time compare of two strings (empty never matches).
 *
 * @param {string} provided
 * @param {string} expected
 * @returns {boolean}
 */
export function setupTokensMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Extract a setup token from Authorization Bearer or X-Setup-Token.
 *
 * @param {Request} request
 * @returns {string}
 */
export function extractSetupToken(request) {
  const headerToken = request.headers.get('X-Setup-Token')?.trim() ?? '';
  if (headerToken) return headerToken;

  const auth = request.headers.get('Authorization') ?? '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

/**
 * Whether the request presents a valid SETUP_TOKEN.
 * When SETUP_TOKEN is unset, returns false (CLI seed remains the trusted path).
 *
 * @param {Request} request
 * @returns {boolean}
 */
export function isSetupTokenAuthorized(request) {
  const expected = readConfiguredSetupToken();
  if (!expected) return false;
  return setupTokensMatch(extractSetupToken(request), expected);
}

/**
 * Snapshot of bootstrap readiness for agents and CLI.
 *
 * @returns {Promise<SetupStatus>}
 */
export async function getSetupStatus() {
  const [onboardingAvailable, adminCount, apiKeyList, setupFlag] =
    await Promise.all([
      isOnboardingAvailable(),
      prisma.user.count({ where: { role: 'admin' } }),
      listApiKeys({ page: 1, limit: 1 }),
      prisma.setting.findUnique({
        where: { key: SETTING_KEYS.ADMIN_SETUP_COMPLETE },
      }),
    ]);

  const apiKeyCount = apiKeyList.total;
  const setupTokenConfigured = Boolean(readConfiguredSetupToken());

  return {
    onboardingAvailable,
    adminExists: adminCount > 0,
    adminSetupComplete: setupFlag !== null,
    apiKeyCount,
    bootstrapApiKeyAvailable: apiKeyCount === 0,
    setupTokenConfigured,
  };
}

/**
 * Parse JSON body for first-admin creation.
 *
 * @param {object} body
 * @returns {{ name: string, email: string, password: string, confirmPassword: string }}
 */
export function parseSetupAdminInput(body = {}) {
  const password = String(body.password ?? '');
  const confirmPassword =
    body.confirmPassword !== undefined && body.confirmPassword !== null
      ? String(body.confirmPassword)
      : password;

  return {
    name: String(body.name ?? ''),
    email: String(body.email ?? ''),
    password,
    confirmPassword,
  };
}

/**
 * Create the first admin when onboarding is still available.
 *
 * @param {object} body
 * @returns {Promise<{ admin: { id: string, email: string, name: string, role: string } }>}
 */
export async function createSetupAdmin(body) {
  const input = parseSetupAdminInput(body);
  const user = await createFirstAdmin(input);

  logger.info({ userId: user.id }, 'Setup: first admin created via API');

  return {
    admin: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

/**
 * Map createSetupAdmin failures to HTTP payloads.
 *
 * @param {Error & { code?: string, errors?: Record<string, string> }} error
 * @param {{ name?: string, email?: string }} fields
 * @returns {{ status: number, body: object } | null}
 */
export function mapSetupAdminError(error, fields) {
  return mapOnboardingActionError(error, {
    name: fields.name ?? '',
    email: fields.email ?? '',
  });
}

/**
 * Create the first bootstrap API key when none exist.
 * Requires a valid SETUP_TOKEN (or call createBootstrapApiKeyTrusted from CLI).
 *
 * @param {{ label?: string, scopes?: string[], expiresAt?: string|Date|null }} [params]
 * @returns {Promise<{ key: string, apiKey: object }>}
 */
export async function createBootstrapApiKey(params = {}) {
  const status = await getSetupStatus();
  if (!status.bootstrapApiKeyAvailable) {
    throw Object.assign(
      new Error(
        'Bootstrap API key already created. Use an existing admin key.'
      ),
      { code: 'BOOTSTRAP_KEY_EXISTS', status: 409 }
    );
  }

  if (!status.adminExists && !status.onboardingAvailable) {
    throw Object.assign(
      new Error(
        'No admin user exists. Create the first admin before an API key.'
      ),
      { code: 'ADMIN_REQUIRED', status: 422 }
    );
  }

  // Prefer creating a key only after an admin exists; allow during open onboarding
  // only when an admin was already seeded without the setup flag.
  if (!status.adminExists) {
    throw Object.assign(
      new Error(
        'Create the first admin before requesting a bootstrap API key.'
      ),
      { code: 'ADMIN_REQUIRED', status: 422 }
    );
  }

  return createBootstrapApiKeyTrusted(params);
}

/**
 * Trusted bootstrap key creation (CLI / seed). Skips SETUP_TOKEN checks.
 * Still refuses when any API key already exists.
 *
 * @param {{ label?: string, scopes?: string[], expiresAt?: string|Date|null }} [params]
 * @returns {Promise<{ key: string, apiKey: object }>}
 */
export async function createBootstrapApiKeyTrusted(params = {}) {
  const { total } = await listApiKeys({ page: 1, limit: 1 });
  if (total > 0) {
    throw Object.assign(
      new Error(
        'Bootstrap API key already created. Use an existing admin key.'
      ),
      { code: 'BOOTSTRAP_KEY_EXISTS', status: 409 }
    );
  }

  const label = params.label?.toString().trim() || BOOTSTRAP_API_KEY_LABEL;
  const { key, record } = await createApiKey({
    label,
    scopes: params.scopes ?? ['admin'],
    expiresAt: params.expiresAt,
  });

  logger.info({ id: record.id, label }, 'Setup: bootstrap API key created');
  return { key, apiKey: record };
}

/**
 * Validate input without creating (for dry checks).
 *
 * @param {object} body
 * @returns {Record<string, string>|null}
 */
export function validateSetupAdminInput(body) {
  return validateOnboardingInput(parseSetupAdminInput(body));
}
