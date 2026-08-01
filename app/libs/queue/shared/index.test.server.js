import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetThrottleMap,
  createThrottledJob,
} from '#/libs/queue/shared/index.server';

describe('createThrottledJob', () => {
  afterEach(() => {
    __resetThrottleMap();
    vi.useRealTimers();
  });

  it('calls fn on first invocation', () => {
    const fn = vi.fn();
    const throttled = createThrottledJob(fn, (value) => `key:${value}`, 1000);

    throttled('a');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('skips calls within the throttle window for the same key', () => {
    const fn = vi.fn();
    const throttled = createThrottledJob(fn, (value) => `key:${value}`, 1000);

    throttled('a');
    throttled('a');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows calls after the throttle window expires', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = createThrottledJob(fn, (value) => `key:${value}`, 1000);

    throttled('a');
    vi.advanceTimersByTime(1001);
    throttled('a');

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throttles keys independently', () => {
    const fn = vi.fn();
    const throttled = createThrottledJob(fn, (value) => `key:${value}`, 1000);

    throttled('a');
    throttled('b');

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
