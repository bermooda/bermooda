import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockJob = vi.hoisted(() => ({
  process: vi.fn(),
  on: vi.fn(),
  add: vi.fn(),
}));

const mockQueue = vi.hoisted(() => ({
  createJob: vi.fn(() => mockJob),
  close: vi.fn(),
}));

vi.mock('@sturmfrei/litequu', () => ({
  default: class MockQueue {
    constructor() {
      return mockQueue;
    }
  },
}));

vi.mock('#/libs/error/index.server', () => ({
  handleError: vi.fn(),
}));

vi.mock('#/utils/logger.server', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { handleError } from '#/libs/error/index.server';

describe('defineQueueJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJob.process.mockReset();
    mockJob.on.mockReset();
    mockQueue.createJob.mockClear();
    mockQueue.createJob.mockImplementation(() => mockJob);
  });

  it('registers process and failed handlers on the queue singleton', async () => {
    const failedHandlers = [];
    mockJob.on.mockImplementation((event, handler) => {
      if (event === 'failed') {
        failedHandlers.push(handler);
      }
    });

    const { defineQueueJob } = await import('#/libs/queue/client.server');
    const processFn = vi.fn();

    const job = defineQueueJob('test_job', {
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
