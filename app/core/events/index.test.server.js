import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger to avoid pino transport setup in tests.
vi.mock('#/utils/logger.server', () => ({
  default: {
    error: vi.fn(),
  },
}));

// Import after mock is registered.
const { emit, on, off, _handlers } = await import('#/core/events/index.server');

describe('event bus', () => {
  beforeEach(() => {
    // Clear all registered handlers between tests.
    _handlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('on + emit basic dispatch', () => {
    it('calls a registered handler with the payload', async () => {
      const handler = vi.fn();
      on('order.created', handler);

      await emit('order.created', { orderId: 1 });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ orderId: 1 });
    });

    it('does not call handlers registered for a different event', async () => {
      const handler = vi.fn();
      on('order.created', handler);

      await emit('customer.registered', { customerId: 42 });

      expect(handler).not.toHaveBeenCalled();
    });

    it('emitting an event with no handlers does not throw', async () => {
      await expect(emit('no.handlers', {})).resolves.toBeUndefined();
    });
  });

  describe('registration-order dispatch', () => {
    it('calls multiple handlers in registration order', async () => {
      const calls = [];
      on('order.created', () => calls.push('first'));
      on('order.created', () => calls.push('second'));
      on('order.created', () => calls.push('third'));

      await emit('order.created', {});

      expect(calls).toEqual(['first', 'second', 'third']);
    });

    it('awaits each handler before proceeding to the next', async () => {
      const calls = [];

      on('order.created', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        calls.push('slow');
      });
      on('order.created', () => calls.push('fast'));

      await emit('order.created', {});

      expect(calls).toEqual(['slow', 'fast']);
    });
  });

  describe('error isolation — non-checkout events', () => {
    it('catches a throwing handler and calls subsequent handlers', async () => {
      const afterHandler = vi.fn();

      on('order.created', () => {
        throw new Error('handler boom');
      });
      on('order.created', afterHandler);

      await expect(
        emit('order.created', { orderId: 99 })
      ).resolves.toBeUndefined();
      expect(afterHandler).toHaveBeenCalledOnce();
    });

    it('logs the error when a non-checkout handler throws', async () => {
      const { default: logger } = await import('#/utils/logger.server');

      on('payment.refunded', () => {
        throw new Error('refund error');
      });

      await emit('payment.refunded', {});

      expect(logger.error).toHaveBeenCalledOnce();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'payment.refunded',
          err: expect.any(Error),
        }),
        expect.any(String)
      );
    });
  });

  describe('off — handler deregistration', () => {
    it('removes a registered handler', async () => {
      const calls = [];
      const handler = () => calls.push(1);
      on('test.off', handler);
      off('test.off', handler);
      await emit('test.off', {});
      expect(calls).toHaveLength(0);
    });

    it('only removes the matching reference', async () => {
      const calls = [];
      const h1 = () => calls.push(1);
      const h2 = () => calls.push(2);
      on('test.off2', h1);
      on('test.off2', h2);
      off('test.off2', h1);
      await emit('test.off2', {});
      expect(calls).toEqual([2]);
    });

    it('is a no-op for an unregistered event', () => {
      expect(() => off('nonexistent', () => {})).not.toThrow();
    });
  });

  describe('checkout.* events — errors rethrow', () => {
    it('rethrows when a handler on a checkout.* event throws', async () => {
      on('checkout.completed', () => {
        throw new Error('checkout failure');
      });

      await expect(emit('checkout.completed', {})).rejects.toThrow(
        'checkout failure'
      );
    });

    it('stops dispatch on first error in a checkout.* event', async () => {
      const afterHandler = vi.fn();

      on('checkout.started', () => {
        throw new Error('checkout started failure');
      });
      on('checkout.started', afterHandler);

      await expect(emit('checkout.started', {})).rejects.toThrow();
      expect(afterHandler).not.toHaveBeenCalled();
    });

    it('dispatches successfully when no checkout.* handler throws', async () => {
      const handler = vi.fn();
      on('checkout.completed', handler);

      await expect(
        emit('checkout.completed', { total: 100 })
      ).resolves.toBeUndefined();
      expect(handler).toHaveBeenCalledWith({ total: 100 });
    });
  });
});
