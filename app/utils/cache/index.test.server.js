import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearCache,
  getCachedResult,
  invalidateCacheKey,
  invalidateCachePrefix,
} from '#/utils/cache/index.server';

beforeEach(() => {
  clearCache();
});

/** @returns {{ promise: Promise<string>, resolve: (value: string) => void }} */
function deferred() {
  let resolve = /** @type {(value: string) => void} */ (() => {});
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('getCachedResult', () => {
  it('calls the callback on first invocation and caches the result', async () => {
    const cb = vi.fn().mockResolvedValue('hello');
    const result = await getCachedResult('test:basic', cb);
    expect(result).toBe('hello');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not call the callback on subsequent invocations', async () => {
    const cb = vi.fn().mockResolvedValue('hello');
    await getCachedResult('test:hit', cb);
    const result = await getCachedResult('test:hit', cb);
    expect(result).toBe('hello');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('caches null without re-invoking the callback', async () => {
    const cb = vi.fn().mockResolvedValue(null);
    await getCachedResult('test:null', cb);
    const result = await getCachedResult('test:null', cb);
    expect(result).toBeNull();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('caches 0 without re-invoking the callback', async () => {
    const cb = vi.fn().mockResolvedValue(0);
    await getCachedResult('test:zero', cb);
    const result = await getCachedResult('test:zero', cb);
    expect(result).toBe(0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('caches false without re-invoking the callback', async () => {
    const cb = vi.fn().mockResolvedValue(false);
    await getCachedResult('test:false', cb);
    const result = await getCachedResult('test:false', cb);
    expect(result).toBe(false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('caches empty string without re-invoking the callback', async () => {
    const cb = vi.fn().mockResolvedValue('');
    await getCachedResult('test:emptystr', cb);
    const result = await getCachedResult('test:emptystr', cb);
    expect(result).toBe('');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('re-invokes the callback after the cache entry is evicted', async () => {
    const cb = vi.fn().mockResolvedValue('fresh');

    await getCachedResult('test:evict', cb);
    expect(cb).toHaveBeenCalledTimes(1);

    invalidateCacheKey('test:evict');

    const result = await getCachedResult('test:evict', cb);
    expect(result).toBe('fresh');
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('shares one refresh between concurrent misses', async () => {
    const { promise, resolve } = deferred();
    const cb = vi.fn(() => promise);

    const results = Promise.all([
      getCachedResult('test:herd', cb),
      getCachedResult('test:herd', cb),
      getCachedResult('test:herd', cb),
    ]);
    resolve('value');

    expect(await results).toEqual(['value', 'value', 'value']);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed refresh', async () => {
    const cb = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce('recovered');

    await expect(getCachedResult('test:error', cb)).rejects.toThrow('db down');
    expect(await getCachedResult('test:error', cb)).toBe('recovered');
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('does not cache a refresh that was invalidated while running', async () => {
    const stale = deferred();
    const first = getCachedResult('setting:x', () => stale.promise);

    invalidateCacheKey('setting:x');
    stale.resolve('old');
    expect(await first).toBe('old');

    const cb = vi.fn().mockResolvedValue('new');
    expect(await getCachedResult('setting:x', cb)).toBe('new');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('prefix invalidation also drops in-flight refreshes', async () => {
    const stale = deferred();
    const first = getCachedResult('i18n:de', () => stale.promise);

    invalidateCachePrefix('i18n:');
    stale.resolve('old catalog');
    await first;

    const cb = vi.fn().mockResolvedValue('new catalog');
    expect(await getCachedResult('i18n:de', cb)).toBe('new catalog');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
