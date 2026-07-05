import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger to avoid pino transport setup in tests.
vi.mock('#/utils/logger.server', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mock is registered.
const {
  emit,
  emitBefore,
  deny,
  HookAbortError,
  isHookAbort,
  on,
  off,
  _handlers,
} = await import('#/core/events/index.server');

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

  describe('emitBefore — blocking filter pipeline', () => {
    it('calls registered handlers in registration order', async () => {
      const calls = [];
      on('before.shipment.create', () => calls.push('first'));
      on('before.shipment.create', () => calls.push('second'));

      const payload = { orderId: 'order_1' };
      const result = await emitBefore('shipment.create', payload);

      expect(calls).toEqual(['first', 'second']);
      expect(result).toBe(payload);
    });

    it('resolves and returns the payload when no handlers are registered', async () => {
      const payload = { orderId: 'order_1' };
      await expect(emitBefore('shipment.create', payload)).resolves.toBe(
        payload
      );
    });

    it('propagates HookAbortError from deny() and stops later handlers', async () => {
      const afterHandler = vi.fn();
      on('before.shipment.ship', () => {
        deny('Order is on fraud hold', { code: 'FRAUD_HOLD' });
      });
      on('before.shipment.ship', afterHandler);

      await expect(
        emitBefore('shipment.ship', { orderId: 'order_1' })
      ).rejects.toBeInstanceOf(HookAbortError);
      expect(afterHandler).not.toHaveBeenCalled();
    });

    it('logs a warning when a handler vetoes via deny()', async () => {
      const { default: logger } = await import('#/utils/logger.server');

      on('before.shipment.create', () => {
        deny('Blocked', { code: 'FRAUD_HOLD', pluginId: 'fraud-guard' });
      });

      await expect(
        emitBefore('shipment.create', { orderId: 'order_1' })
      ).rejects.toBeInstanceOf(HookAbortError);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'before.shipment.create',
          code: 'FRAUD_HOLD',
          pluginId: 'fraud-guard',
          reason: 'Blocked',
        }),
        'action blocked by before-hook'
      );
    });

    it('propagates a plain Error and stops later handlers (fail-closed)', async () => {
      const afterHandler = vi.fn();
      on('before.refund.create', () => {
        throw new Error('filter crash');
      });
      on('before.refund.create', afterHandler);

      await expect(
        emitBefore('refund.create', { orderId: 'order_1' })
      ).rejects.toThrow('filter crash');
      expect(afterHandler).not.toHaveBeenCalled();
    });

    it('logs an error when a non-veto handler throws', async () => {
      const { default: logger } = await import('#/utils/logger.server');

      on('before.order.cancel', () => {
        throw new Error('broken filter');
      });

      await expect(
        emitBefore('order.cancel', { orderId: 'order_1' })
      ).rejects.toThrow('broken filter');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'before.order.cancel' }),
        'before-hook handler error — aborting action'
      );
    });
  });

  describe('HookAbortError helpers', () => {
    it('isHookAbort returns true for HookAbortError instances', () => {
      expect(isHookAbort(new HookAbortError('blocked'))).toBe(true);
      expect(isHookAbort({ blocked: true })).toBe(true);
      expect(isHookAbort(new Error('nope'))).toBe(false);
    });
  });

  describe('checkout.* events use the normal post-hook isolation path', () => {
    it('swallows errors when a handler on a checkout.* event throws', async () => {
      on('checkout.completed', () => {
        throw new Error('checkout failure');
      });

      await expect(emit('checkout.completed', {})).resolves.toBeUndefined();
    });

    it('continues dispatch after an error in a checkout.* event', async () => {
      const afterHandler = vi.fn();

      on('checkout.started', () => {
        throw new Error('checkout started failure');
      });
      on('checkout.started', afterHandler);

      await expect(emit('checkout.started', {})).resolves.toBeUndefined();
      expect(afterHandler).toHaveBeenCalledOnce();
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
