// Symmetric encryption for secrets stored in the database (plugin password settings).
// Uses AES-256-GCM with a key derived from BETTER_AUTH_SECRET.

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/** Ciphertext prefix so stored values are detectable. */
export const ENCRYPTED_SECRET_PREFIX = 'enc:v1:';

/**
 * Sentinel returned by loadPluginSettings for password fields that have a value.
 * Never decrypts or exposes the secret to admin/API clients.
 */
export const PASSWORD_SETTING_SET = '••••••••';

/**
 * Derive a 32-byte AES key from BETTER_AUTH_SECRET.
 *
 * @returns {Buffer}
 */
function deriveKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    throw new Error(
      'BETTER_AUTH_SECRET is required to encrypt and decrypt secrets at rest'
    );
  }
  return createHash('sha256').update(secret).digest();
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEncryptedSecret(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_SECRET_PREFIX);
}

/**
 * Encrypt a plaintext secret for database storage.
 *
 * @param {string} plaintext
 * @returns {string} Opaque ciphertext (`enc:v1:…`)
 */
export function encryptSecret(plaintext) {
  const text = String(plaintext);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return (
    ENCRYPTED_SECRET_PREFIX +
    [
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':')
  );
}

/**
 * Decrypt a value previously produced by {@link encryptSecret}.
 * Plain (non-prefixed) strings are returned as-is for robustness.
 *
 * @param {string} ciphertext
 * @returns {string}
 */
export function decryptSecret(ciphertext) {
  if (ciphertext == null) {
    throw new Error('Cannot decrypt empty secret');
  }
  const raw = String(ciphertext);
  if (!isEncryptedSecret(raw)) {
    return raw;
  }

  const parts = raw.split(':');
  // enc:v1:<iv>:<tag>:<data>
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('Invalid encrypted secret format');
  }

  const iv = Buffer.from(parts[2], 'base64url');
  const tag = Buffer.from(parts[3], 'base64url');
  const data = Buffer.from(parts[4], 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8'
  );
}

/**
 * Whether a submitted password field should leave the stored value unchanged.
 *
 * @param {unknown} raw
 * @returns {boolean}
 */
export function shouldKeepExistingPassword(raw) {
  if (raw === undefined || raw === null) return true;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed === '' || trimmed === PASSWORD_SETTING_SET;
  }
  return false;
}
