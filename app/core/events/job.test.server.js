import { beforeEach, describe, expect, it, vi } from 'vitest';

const jobState = vi.hoisted(() => ({
  add: vi.fn(),
  jobName: null,
  options: null,
  dispatchHandlers: vi.fn(),
}));

vi.mock('#/utils/logger.server', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('#/libs/queue.server', () => ({
  default: { id: 'queue' },
  defineQueueJob: vi.fn((queue, name, options) => {
    jobState.jobName = name;
    jobState.options = options;
    return { add: jobState.add };
  }),
}));

vi.mock('#/core/events/handlers.server', () => ({
  dispatchHandlers: jobState.dispatchHandlers,
}));

describe('domain event queue job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobState.add.mockReset();
    jobState.dispatchHandlers.mockReset();
    jobState.jobName = null;
    jobState.options = null;
    vi.resetModules();
  });

  it('registers the domain_event job', async () => {
    await import('#/core/events/job.server');

    expect(jobState.jobName).toBe('domain_event');
  });

  it('queueEmit adds event and payload to the domain_event job', async () => {
    const { queueEmit } = await import('#/core/events/job.server');

    queueEmit('order.created', { orderId: '1' });

    expect(jobState.add).toHaveBeenCalledWith({
      event: 'order.created',
      payload: { orderId: '1' },
    });
  });

  it('domain_event processor dispatches handlers for valid events', async () => {
    await import('#/core/events/job.server');

    await jobState.options.process({
      event: 'order.created',
      payload: { orderId: '1' },
    });

    expect(jobState.dispatchHandlers).toHaveBeenCalledWith('order.created', {
      orderId: '1',
    });
  });

  it('domain_event processor skips jobs with missing event names', async () => {
    const { default: logger } = await import('#/utils/logger.server');
    await import('#/core/events/job.server');

    await jobState.options.process({ payload: { orderId: '1' } });

    expect(jobState.dispatchHandlers).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      { taskData: { payload: { orderId: '1' } } },
      'domain_event job missing event name; skipping'
    );
  });
});
