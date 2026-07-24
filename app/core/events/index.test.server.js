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

/** Flush microtasks so fire-and-forget post-hook handlers can settle. */
async function flushEmit() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

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

      emit('order.created', { orderId: 1 });
      await flushEmit();

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ orderId: 1 });
    });

    it('does not call handlers registered for a different event', async () => {
      const handler = vi.fn();
      on('order.created', handler);

      emit('customer.registered', { customerId: 42 });
      await flushEmit();

      expect(handler).not.toHaveBeenCalled();
    });

    it('emitting an event with no handlers does not throw', () => {
      expect(() => emit('no.handlers', {})).not.toThrow();
    });

    it('returns immediately without awaiting handlers', async () => {
      let resolveHandler;
      const handlerDone = new Promise((resolve) => {
        resolveHandler = resolve;
      });
      on('order.created', async () => {
        await handlerDone;
      });

      const started = Date.now();
      emit('order.created', {});
      const elapsed = Date.now() - started;

      expect(elapsed).toBeLessThan(20);
      resolveHandler();
      await flushEmit();
    });
  });

  describe('parallel post-hook dispatch', () => {
    it('starts all handlers without waiting for earlier ones to finish', async () => {
      const calls = [];
      let releaseSlow;
      const slowGate = new Promise((resolve) => {
        releaseSlow = resolve;
      });

      on('order.created', async () => {
        await slowGate;
        calls.push('slow');
      });
      on('order.created', () => {
        calls.push('fast');
      });

      emit('order.created', {});
      await flushEmit();

      expect(calls).toEqual(['fast']);
      releaseSlow();
      await flushEmit();
      expect(calls).toEqual(['fast', 'slow']);
    });
  });

  describe('error isolation — post-hooks', () => {
    it('catches a throwing handler and still calls other handlers', async () => {
      const afterHandler = vi.fn();

      on('order.created', () => {
        throw new Error('handler boom');
      });
      on('order.created', afterHandler);

      expect(() => emit('order.created', { orderId: 99 })).not.toThrow();
      await flushEmit();
      expect(afterHandler).toHaveBeenCalledOnce();
    });

    it('logs the error when a handler throws', async () => {
      const { default: logger } = await import('#/utils/logger.server');

      on('payment.refunded', () => {
        throw new Error('refund error');
      });

      emit('payment.refunded', {});
      await flushEmit();

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
      emit('test.off', {});
      await flushEmit();
      expect(calls).toHaveLength(0);
    });

    it('only removes the matching reference', async () => {
      const calls = [];
      const h1 = () => calls.push(1);
      const h2 = () => calls.push(2);
      on('test.off2', h1);
      on('test.off2', h2);
      off('test.off2', h1);
      emit('test.off2', {});
      await flushEmit();
      expect(calls).toEqual([2]);
    });

    it('is a no-op for an unregistered event', () => {
      expect(() => off('nonexistent', () => {})).not.toThrow();
    });
  });

  describe('emitBefore — blocking parallel filter pipeline', () => {
    it('runs all registered handlers and returns the payload', async () => {
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

    it('runs handlers in parallel while still awaiting all before returning', async () => {
      const calls = [];
      let releaseFirst;
      const firstGate = new Promise((resolve) => {
        releaseFirst = resolve;
      });

      on('before.shipment.create', async () => {
        await firstGate;
        calls.push('first');
      });
      on('before.shipment.create', () => {
        calls.push('second');
      });

      const pending = emitBefore('shipment.create', { orderId: 'order_1' });
      await flushEmit();
      expect(calls).toEqual(['second']);

      releaseFirst();
      await pending;
      expect(calls).toEqual(['second', 'first']);
    });

    it('propagates HookAbortError from deny() but still runs later handlers', async () => {
      const afterHandler = vi.fn();
      on('before.shipment.ship', () => {
        deny('Order is on fraud hold', { code: 'FRAUD_HOLD' });
      });
      on('before.shipment.ship', afterHandler);

      await expect(
        emitBefore('shipment.ship', { orderId: 'order_1' })
      ).rejects.toBeInstanceOf(HookAbortError);
      expect(afterHandler).toHaveBeenCalledOnce();
    });

    it('prefers the first-registered HookAbortError when multiple handlers fail', async () => {
      on('before.shipment.create', () => {
        deny('First veto', { code: 'FRAUD_HOLD' });
      });
      on('before.shipment.create', () => {
        deny('Second veto', { code: 'COMPLIANCE_HOLD' });
      });

      await expect(
        emitBefore('shipment.create', { orderId: 'order_1' })
      ).rejects.toMatchObject({
        reason: 'First veto',
        code: 'FRAUD_HOLD',
      });
    });

    it('prefers HookAbortError over a plain Error from another handler', async () => {
      on('before.shipment.create', () => {
        throw new Error('filter crash');
      });
      on('before.shipment.create', () => {
        deny('Blocked', { code: 'FRAUD_HOLD' });
      });

      await expect(
        emitBefore('shipment.create', { orderId: 'order_1' })
      ).rejects.toMatchObject({
        reason: 'Blocked',
        code: 'FRAUD_HOLD',
      });
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

    it('propagates a plain Error and still runs later handlers (fail-closed)', async () => {
      const afterHandler = vi.fn();
      on('before.refund.create', () => {
        throw new Error('filter crash');
      });
      on('before.refund.create', afterHandler);

      await expect(
        emitBefore('refund.create', { orderId: 'order_1' })
      ).rejects.toThrow('filter crash');
      expect(afterHandler).toHaveBeenCalledOnce();
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

      expect(() => emit('checkout.completed', {})).not.toThrow();
      await flushEmit();
    });

    it('continues dispatch after an error in a checkout.* event', async () => {
      const afterHandler = vi.fn();

      on('checkout.started', () => {
        throw new Error('checkout started failure');
      });
      on('checkout.started', afterHandler);

      expect(() => emit('checkout.started', {})).not.toThrow();
      await flushEmit();
      expect(afterHandler).toHaveBeenCalledOnce();
    });

    it('dispatches successfully when no checkout.* handler throws', async () => {
      const handler = vi.fn();
      on('checkout.completed', handler);

      emit('checkout.completed', { total: 100 });
      await flushEmit();
      expect(handler).toHaveBeenCalledWith({ total: 100 });
    });
  });
});
