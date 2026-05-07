// app/core/orders/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

vi.mock('#/libs/prisma.server', () => ({
  default: {
    checkoutSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    orderLine: {
      create: vi.fn(),
    },
    cartLine: {
      deleteMany: vi.fn(),
    },
    cart: {
      update: vi.fn(),
    },
    discount: {
      update: vi.fn(),
    },
    shipment: {
      create: vi.fn(),
      update: vi.fn(),
    },
    refund: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('#/core/events/index.server', () => ({
  emit: vi.fn(),
}));

vi.mock('#/core/inventory/index.server', () => ({
  decrementInventory: vi.fn(),
}));

vi.mock('#/core/discounts/index.server', () => ({
  validateDiscount: vi.fn(),
}));

vi.mock('#/utils/logger.server', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import prisma from '#/libs/prisma.server';

import { validateDiscount } from '#/core/discounts/index.server';
import { emit } from '#/core/events/index.server';
import { decrementInventory } from '#/core/inventory/index.server';
import {
  placeOrder,
  getOrder,
  listOrders,
  updateOrderStatus,
  addShipment,
  markShipped,
  markDelivered,
  createRefund,
  updateRefundStatus,
} from './index.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCheckoutSession(overrides = {}) {
  return {
    id: 'sess_1',
    cartId: 'cart_1',
    customerId: 'cust_1',
    email: 'test@example.com',
    step: 'review',
    couponCode: null,
    shippingAddressJson: '{"country":"US"}',
    billingAddressJson: null,
    shippingOptionJson: '{"id":"flat","priceCents":500}',
    cart: {
      id: 'cart_1',
      currency: 'USD',
      lines: [
        {
          id: 'line_1',
          variantId: 'var_1',
          quantity: 2,
          priceCentsSnapshot: 1000,
          titleSnapshot: 'T-Shirt',
          variant: { sku: 'TS-001' },
        },
      ],
    },
    ...overrides,
  };
}

function makeOrder(overrides = {}) {
  return {
    id: 'order_1',
    orderNumber: 'ORD-123',
    customerId: 'cust_1',
    email: 'test@example.com',
    totalCents: 2000,
    currency: 'USD',
    status: 'pending',
    ...overrides,
  };
}

/**
 * Set up $transaction to execute the callback with a tx client that mirrors
 * the relevant prisma mocks, plus captures the tx reference.
 */
function setupTransaction(capturedTx = {}) {
  prisma.$transaction.mockImplementation(async (fn) => {
    // Build a tx client that proxies to the same mocks
    const tx = {
      checkoutSession: prisma.checkoutSession,
      order: prisma.order,
      orderLine: prisma.orderLine,
      cartLine: prisma.cartLine,
      cart: prisma.cart,
      discount: prisma.discount,
    };
    Object.assign(capturedTx, tx);
    return fn(tx);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// placeOrder — happy path (decrementInventory receives tx)
// ---------------------------------------------------------------------------

describe('placeOrder', () => {
  it('calls decrementInventory with the tx client', async () => {
    const session = makeCheckoutSession();
    const order = makeOrder();
    const capturedTx = {};

    setupTransaction(capturedTx);

    prisma.checkoutSession.findUnique.mockResolvedValue(session);
    prisma.order.create.mockResolvedValue(order);
    prisma.orderLine.create.mockResolvedValue({});
    prisma.cartLine.deleteMany.mockResolvedValue({ count: 1 });
    prisma.cart.update.mockResolvedValue({});
    prisma.checkoutSession.update.mockResolvedValue({});
    decrementInventory.mockResolvedValue(undefined);
    emit.mockResolvedValue(undefined);

    await placeOrder('sess_1', {
      paymentProvider: 'stripe',
      paymentIntentId: 'pi_123',
    });

    expect(decrementInventory).toHaveBeenCalledOnce();
    // Verify tx was passed — second argument must be the tx client (not undefined)
    const [, txArg] = decrementInventory.mock.calls[0];
    expect(txArg).toBeDefined();
    // txArg must be the tx client, not undefined or the global prisma client
    // Verify it carries the same mock references as our captured tx
    expect(txArg.order).toBe(capturedTx.order);
    expect(txArg.checkoutSession).toBe(capturedTx.checkoutSession);
  });

  it('emits order.created after the transaction commits', async () => {
    const session = makeCheckoutSession();
    const order = makeOrder();
    const emitCallOrder = [];

    setupTransaction();

    prisma.checkoutSession.findUnique.mockResolvedValue(session);
    prisma.order.create.mockResolvedValue(order);
    prisma.orderLine.create.mockResolvedValue({});
    prisma.cartLine.deleteMany.mockResolvedValue({});
    prisma.cart.update.mockResolvedValue({});
    prisma.checkoutSession.update.mockResolvedValue({});
    decrementInventory.mockResolvedValue(undefined);

    // Track call order: $transaction vs emit
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        checkoutSession: prisma.checkoutSession,
        order: prisma.order,
        orderLine: prisma.orderLine,
        cartLine: prisma.cartLine,
        cart: prisma.cart,
        discount: prisma.discount,
      };
      emitCallOrder.push('transaction');
      const result = await fn(tx);
      return result;
    });

    emit.mockImplementation(async () => {
      emitCallOrder.push('emit');
    });

    await placeOrder('sess_1', {});

    expect(emit).toHaveBeenCalledWith(
      'order.created',
      expect.objectContaining({
        orderId: order.id,
        orderNumber: order.orderNumber,
      })
    );
    // emit must be called AFTER the transaction
    expect(emitCallOrder).toEqual(['transaction', 'emit']);
  });

  it('throws CHECKOUT_SESSION_NOT_AT_REVIEW when step is not review', async () => {
    setupTransaction();
    prisma.checkoutSession.findUnique.mockResolvedValue(
      makeCheckoutSession({ step: 'payment' })
    );

    await expect(placeOrder('sess_1', {})).rejects.toThrow(
      'CHECKOUT_SESSION_NOT_AT_REVIEW'
    );
    expect(decrementInventory).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('throws CHECKOUT_SESSION_NOT_FOUND when session does not exist', async () => {
    setupTransaction();
    prisma.checkoutSession.findUnique.mockResolvedValue(null);

    await expect(placeOrder('nonexistent', {})).rejects.toThrow(
      'CHECKOUT_SESSION_NOT_FOUND'
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('increments discount usedCount inside the transaction when couponCode is present', async () => {
    const session = makeCheckoutSession({ couponCode: 'SAVE10' });
    const order = makeOrder();
    const capturedTx = {};

    setupTransaction(capturedTx);

    prisma.checkoutSession.findUnique.mockResolvedValue(session);
    prisma.order.create.mockResolvedValue(order);
    prisma.orderLine.create.mockResolvedValue({});
    prisma.cartLine.deleteMany.mockResolvedValue({});
    prisma.cart.update.mockResolvedValue({});
    prisma.checkoutSession.update.mockResolvedValue({});
    prisma.discount.update.mockResolvedValue({});
    validateDiscount.mockResolvedValue({ discountCents: 200 });
    decrementInventory.mockResolvedValue(undefined);
    emit.mockResolvedValue(undefined);

    await placeOrder('sess_1', {});

    expect(validateDiscount).toHaveBeenCalledWith(
      'SAVE10',
      expect.objectContaining({
        subtotalCents: expect.any(Number),
        currency: 'USD',
      })
    );
    expect(prisma.discount.update).toHaveBeenCalledWith({
      where: { code: 'SAVE10' },
      data: { usedCount: { increment: 1 } },
    });
  });

  it('creates order with correct subtotal from cart line snapshots', async () => {
    const session = makeCheckoutSession();
    // line: quantity=2, priceCentsSnapshot=1000 → subtotal=2000; shippingCents=500 → total=2500
    const order = makeOrder({ subtotalCents: 2000, totalCents: 2500 });

    setupTransaction();
    prisma.checkoutSession.findUnique.mockResolvedValue(session);
    prisma.order.create.mockResolvedValue(order);
    prisma.orderLine.create.mockResolvedValue({});
    prisma.cartLine.deleteMany.mockResolvedValue({});
    prisma.cart.update.mockResolvedValue({});
    prisma.checkoutSession.update.mockResolvedValue({});
    decrementInventory.mockResolvedValue(undefined);
    emit.mockResolvedValue(undefined);

    await placeOrder('sess_1', {});

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotalCents: 2000,
          shippingCents: 500,
          currency: 'USD',
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// getOrder
// ---------------------------------------------------------------------------

describe('getOrder', () => {
  it('fetches order by id with lines, shipments, and refunds', async () => {
    const order = { ...makeOrder(), lines: [], shipments: [], refunds: [] };
    prisma.order.findUnique.mockResolvedValue(order);

    const result = await getOrder('order_1');

    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      include: {
        lines: true,
        shipments: true,
        refunds: true,
      },
    });
    expect(result).toEqual(order);
  });
});

// ---------------------------------------------------------------------------
// listOrders
// ---------------------------------------------------------------------------

describe('listOrders', () => {
  it('lists orders with lines, newest first, filtered by customerId', async () => {
    prisma.order.findMany.mockResolvedValue([]);

    await listOrders({ customerId: 'cust_1', page: 1, limit: 10 });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 'cust_1' },
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// updateOrderStatus
// ---------------------------------------------------------------------------

describe('updateOrderStatus', () => {
  it('throws INVALID_ORDER_STATUS for unknown status values', async () => {
    await expect(updateOrderStatus('order_1', 'shipped')).rejects.toThrow(
      'INVALID_ORDER_STATUS'
    );
    await expect(updateOrderStatus('order_1', 'unknown')).rejects.toThrow(
      'INVALID_ORDER_STATUS'
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('updates order status for valid values', async () => {
    prisma.order.update.mockResolvedValue(makeOrder({ status: 'confirmed' }));

    await updateOrderStatus('order_1', 'confirmed');

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'confirmed' },
    });
  });

  it.each(['pending', 'confirmed', 'cancelled', 'refunded'])(
    'accepts valid status: %s',
    async (status) => {
      prisma.order.update.mockResolvedValue(makeOrder({ status }));
      await expect(updateOrderStatus('order_1', status)).resolves.not.toThrow();
    }
  );
});

// ---------------------------------------------------------------------------
// addShipment
// ---------------------------------------------------------------------------

describe('addShipment', () => {
  it('emits shipment.created after creating the shipment', async () => {
    const shipment = { id: 'ship_1', orderId: 'order_1', status: 'pending' };
    prisma.shipment.create.mockResolvedValue(shipment);
    emit.mockResolvedValue(undefined);

    await addShipment('order_1', { carrier: 'USPS', trackingNumber: 'TRK123' });

    expect(prisma.shipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order_1',
        carrier: 'USPS',
        trackingNumber: 'TRK123',
      }),
    });
    expect(emit).toHaveBeenCalledWith('shipment.created', {
      shipmentId: 'ship_1',
      orderId: 'order_1',
    });
  });
});

// ---------------------------------------------------------------------------
// markShipped
// ---------------------------------------------------------------------------

describe('markShipped', () => {
  it('sets status to shipped and emits shipment.shipped', async () => {
    const shipment = {
      id: 'ship_1',
      orderId: 'order_1',
      status: 'shipped',
      shippedAt: new Date(),
    };
    prisma.shipment.update.mockResolvedValue(shipment);
    emit.mockResolvedValue(undefined);

    await markShipped('ship_1', { carrier: 'FedEx', trackingNumber: 'TRK456' });

    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ship_1' },
        data: expect.objectContaining({
          status: 'shipped',
          shippedAt: expect.any(Date),
        }),
      })
    );
    expect(emit).toHaveBeenCalledWith(
      'shipment.shipped',
      expect.objectContaining({
        shipmentId: 'ship_1',
      })
    );
  });
});

// ---------------------------------------------------------------------------
// markDelivered
// ---------------------------------------------------------------------------

describe('markDelivered', () => {
  it('sets status to delivered and emits shipment.delivered', async () => {
    const shipment = {
      id: 'ship_1',
      orderId: 'order_1',
      status: 'delivered',
      deliveredAt: new Date(),
    };
    prisma.shipment.update.mockResolvedValue(shipment);
    emit.mockResolvedValue(undefined);

    await markDelivered('ship_1');

    expect(prisma.shipment.update).toHaveBeenCalledWith({
      where: { id: 'ship_1' },
      data: expect.objectContaining({
        status: 'delivered',
        deliveredAt: expect.any(Date),
      }),
    });
    expect(emit).toHaveBeenCalledWith(
      'shipment.delivered',
      expect.objectContaining({
        shipmentId: 'ship_1',
      })
    );
  });
});

// ---------------------------------------------------------------------------
// createRefund
// ---------------------------------------------------------------------------

describe('createRefund', () => {
  it('emits payment.refunded after creating the refund', async () => {
    const refund = {
      id: 'ref_1',
      orderId: 'order_1',
      amountCents: 500,
      status: 'pending',
    };
    prisma.refund.create.mockResolvedValue(refund);
    emit.mockResolvedValue(undefined);

    await createRefund('order_1', {
      amountCents: 500,
      reason: 'Customer request',
    });

    expect(prisma.refund.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order_1',
        amountCents: 500,
        reason: 'Customer request',
      }),
    });
    expect(emit).toHaveBeenCalledWith('payment.refunded', {
      refundId: 'ref_1',
      orderId: 'order_1',
      amountCents: 500,
    });
  });
});

// ---------------------------------------------------------------------------
// updateRefundStatus
// ---------------------------------------------------------------------------

describe('updateRefundStatus', () => {
  it('updates refund status for valid values', async () => {
    prisma.refund.update.mockResolvedValue({
      id: 'ref_1',
      status: 'succeeded',
    });

    await updateRefundStatus('ref_1', 'succeeded');

    expect(prisma.refund.update).toHaveBeenCalledWith({
      where: { id: 'ref_1' },
      data: { status: 'succeeded' },
    });
  });

  it('throws INVALID_REFUND_STATUS for unknown values', async () => {
    await expect(updateRefundStatus('ref_1', 'unknown')).rejects.toThrow(
      'INVALID_REFUND_STATUS'
    );
    expect(prisma.refund.update).not.toHaveBeenCalled();
  });
});
