// app/core/extensions/engine.test.js
import { describe, expect, it } from 'vitest';

import {
  assertEngineRange,
  checkExtensionEngine,
  getAppVersion,
  isEngineCompatible,
} from '#/core/extensions/engine';

describe('assertEngineRange', () => {
  it('returns trimmed range when valid', () => {
    expect(assertEngineRange('>=1.0.0')).toBe('>=1.0.0');
    expect(assertEngineRange('  >=1.0.0  ')).toBe('>=1.0.0');
  });

  it('throws when missing or invalid', () => {
    expect(() => assertEngineRange(undefined)).toThrow(/engine/);
    expect(() => assertEngineRange(null)).toThrow(/engine/);
    expect(() => assertEngineRange('')).toThrow(/engine/);
    expect(() => assertEngineRange('   ')).toThrow(/engine/);
    expect(() => assertEngineRange('not-a-range')).toThrow(/engine/);
  });
});

describe('isEngineCompatible', () => {
  it('returns true when shop satisfies range', () => {
    expect(isEngineCompatible('1.0.0', '>=1.0.0')).toBe(true);
    expect(isEngineCompatible('2.5.0', '>=1.0.0')).toBe(true);
  });

  it('returns false when shop does not satisfy range', () => {
    expect(isEngineCompatible('1.0.0', '>=2.0.0')).toBe(false);
  });
});

describe('getAppVersion', () => {
  it('returns a valid semver from root package.json', () => {
    expect(getAppVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('checkExtensionEngine', () => {
  it('returns ok with the resolved range when compatible', () => {
    expect(
      checkExtensionEngine({
        shopVersion: '1.0.0',
        engine: '>=1.0.0',
        kind: 'plugin',
        id: 'fraud-guard',
      })
    ).toEqual({ ok: true, engine: '>=1.0.0' });
  });

  it('returns a reason mentioning kind, id, range, and shop version when incompatible', () => {
    const result = checkExtensionEngine({
      shopVersion: '1.0.0',
      engine: '>=2.0.0',
      kind: 'plugin',
      id: 'fraud-guard',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/fraud-guard/);
    expect(result.reason).toMatch(/>=2\.0\.0/);
    expect(result.reason).toMatch(/1\.0\.0/);
  });

  it('returns not-ok when engine is missing or invalid, without throwing', () => {
    const missing = checkExtensionEngine({
      shopVersion: '1.0.0',
      engine: undefined,
      kind: 'theme',
      id: 'default',
    });
    expect(missing.ok).toBe(false);
    expect(missing.reason).toMatch(/engine/);

    const invalid = checkExtensionEngine({
      shopVersion: '1.0.0',
      engine: 'not-a-range',
      kind: 'theme',
      id: 'default',
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.reason).toMatch(/engine/);
  });

  it('falls back to kind label when id is not provided', () => {
    const result = checkExtensionEngine({
      shopVersion: '1.0.0',
      engine: '>=2.0.0',
      kind: 'plugin',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/^plugin /);
  });
});
