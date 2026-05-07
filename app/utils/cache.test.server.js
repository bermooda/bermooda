import { beforeEach, describe, expect, it, vi } from 'vitest';

import cache, { getCachedResult } from '#/utils/cache.server';

beforeEach(() => {
  cache.clear();
});

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

    // Simulate TTL expiry by manually evicting the entry.
    cache.delete('test:evict');

    const result = await getCachedResult('test:evict', cb);
    expect(result).toBe('fresh');
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
