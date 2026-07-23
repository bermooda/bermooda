import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetThrottleMap,
  createThrottledJob,
  defineQueueJob,
} from '#/libs/queue/shared/index.server';

vi.mock('#/libs/error/index.server', () => ({
  handleError: vi.fn(),
}));

import { handleError } from '#/libs/error/index.server';

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

describe('defineQueueJob', () => {
  it('registers process and failed handlers', async () => {
    const processFn = vi.fn();
    const failedHandlers = [];
    const mockJob = {
      process: vi.fn(),
      on: vi.fn((event, handler) => {
        if (event === 'failed') {
          failedHandlers.push(handler);
        }
      }),
      add: vi.fn(),
    };
    const mockQueue = {
      createJob: vi.fn(() => mockJob),
    };

    const job = defineQueueJob(mockQueue, 'test_job', {
      process: processFn,
      onFailed: {
        message: 'Job failed',
        source: 'test defineQueueJob',
      },
    });

    expect(mockQueue.createJob).toHaveBeenCalledWith('test_job');
    expect(mockJob.process).toHaveBeenCalledWith(processFn);
    expect(mockJob.on).toHaveBeenCalledWith('failed', expect.any(Function));
    expect(job).toBe(mockJob);

    const error = new Error('boom');
    await failedHandlers[0]({ error });

    expect(handleError).toHaveBeenCalledWith(error, {
      message: 'Job failed',
      source: 'test defineQueueJob',
    });
  });
});
