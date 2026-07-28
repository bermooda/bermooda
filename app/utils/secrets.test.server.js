import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  decryptSecret,
  encryptSecret,
  ENCRYPTED_SECRET_PREFIX,
  isEncryptedSecret,
  PASSWORD_SETTING_SET,
  shouldKeepExistingPassword,
} from '#/utils/secrets.server';

describe('secrets.server', () => {
  const previousSecret = process.env.BETTER_AUTH_SECRET;

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret-for-unit-tests';
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = previousSecret;
    }
  });

  it('encrypts and decrypts round-trip', () => {
    const ciphertext = encryptSecret('re_live_abc123');
    expect(isEncryptedSecret(ciphertext)).toBe(true);
    expect(ciphertext.startsWith(ENCRYPTED_SECRET_PREFIX)).toBe(true);
    expect(ciphertext).not.toContain('re_live_abc123');
    expect(decryptSecret(ciphertext)).toBe('re_live_abc123');
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encryptSecret('same');
    const b = encryptSecret('same');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same');
    expect(decryptSecret(b)).toBe('same');
  });

  it('returns plaintext unchanged when value is not encrypted', () => {
    expect(decryptSecret('plain-api-key')).toBe('plain-api-key');
  });

  it('throws when BETTER_AUTH_SECRET is missing', () => {
    delete process.env.BETTER_AUTH_SECRET;
    expect(() => encryptSecret('x')).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('shouldKeepExistingPassword treats empty and sentinel as keep', () => {
    expect(shouldKeepExistingPassword('')).toBe(true);
    expect(shouldKeepExistingPassword('   ')).toBe(true);
    expect(shouldKeepExistingPassword(PASSWORD_SETTING_SET)).toBe(true);
    expect(shouldKeepExistingPassword(null)).toBe(true);
    expect(shouldKeepExistingPassword(undefined)).toBe(true);
    expect(shouldKeepExistingPassword('new-secret')).toBe(false);
  });
});
