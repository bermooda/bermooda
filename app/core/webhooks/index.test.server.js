// app/core/webhooks/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock prisma — must be hoisted before other imports
// ---------------------------------------------------------------------------

vi.mock('#/libs/prisma.server', () => {
  const webhookSubscription = {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  };
  const webhookDelivery = {
    create: vi.fn(),
    findMany: vi.fn(),
  };
  return { default: { webhookSubscription, webhookDelivery } };
});

// Mock logger to suppress output
vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import prisma from '#/libs/prisma.server';

import {
  WEBHOOK_EVENTS,
  createSubscription,
  deleteSubscription,
  dispatchWebhookEvent,
  getSubscription,
  listSubscriptions,
  setWebhookJobEnqueuer,
} from './index.server';

beforeEach(() => {
  vi.clearAllMocks();
  setWebhookJobEnqueuer(null);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSub(overrides = {}) {
  return {
    id: 'sub-1',
    label: 'My hook',
    url: 'https://example.com/hook',
    events: '["order.created"]',
    secret: 'whsec_test',
    active: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('createSubscription', () => {
  it('creates and returns a serialized subscription', async () => {
    const sub = makeSub();
    prisma.webhookSubscription.create.mockResolvedValue(sub);

    const result = await createSubscription({
      url: 'https://example.com/hook',
      events: ['order.created'],
      secret: 'whsec_test',
      label: 'My hook',
    });

    expect(result.id).toBe('sub-1');
    expect(result.events).toEqual(['order.created']);
    expect(result.active).toBe(true);
    expect(prisma.webhookSubscription.create).toHaveBeenCalledOnce();
  });

  it('throws URL_REQUIRED when url is empty', async () => {
    await expect(
      createSubscription({ url: '', events: ['order.created'], secret: 'x' })
    ).rejects.toMatchObject({ code: 'URL_REQUIRED' });
    expect(prisma.webhookSubscription.create).not.toHaveBeenCalled();
  });

  it('throws EVENTS_REQUIRED when events is empty array', async () => {
    await expect(
      createSubscription({ url: 'https://x.com', events: [], secret: 'x' })
    ).rejects.toMatchObject({ code: 'EVENTS_REQUIRED' });
  });

  it('throws SECRET_REQUIRED when secret is empty', async () => {
    await expect(
      createSubscription({
        url: 'https://x.com',
        events: ['order.created'],
        secret: '',
      })
    ).rejects.toMatchObject({ code: 'SECRET_REQUIRED' });
  });
});

// ---------------------------------------------------------------------------

describe('listSubscriptions', () => {
  it('returns subscriptions with events parsed as arrays', async () => {
    prisma.webhookSubscription.findMany.mockResolvedValue([
      makeSub({ id: '1', events: '["order.created"]' }),
      makeSub({ id: '2', events: '["payment.refunded"]' }),
    ]);

    const subs = await listSubscriptions();
    expect(subs).toHaveLength(2);
    for (const sub of subs) {
      expect(Array.isArray(sub.events)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------

describe('getSubscription', () => {
  it('returns a serialized subscription', async () => {
    prisma.webhookSubscription.findUnique.mockResolvedValue(makeSub());
    const result = await getSubscription('sub-1');
    expect(result.id).toBe('sub-1');
    expect(result.events).toEqual(['order.created']);
  });

  it('throws NOT_FOUND for unknown id', async () => {
    prisma.webhookSubscription.findUnique.mockResolvedValue(null);
    await expect(getSubscription('nonexistent')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});

// ---------------------------------------------------------------------------

describe('deleteSubscription', () => {
  it('calls prisma.webhookSubscription.delete', async () => {
    prisma.webhookSubscription.delete.mockResolvedValue({});
    await deleteSubscription('sub-1');
    expect(prisma.webhookSubscription.delete).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
    });
  });
});

// ---------------------------------------------------------------------------

describe('dispatchWebhookEvent', () => {
  it('creates a WebhookDelivery and calls the enqueuer for matching subscriptions', async () => {
    const enqueuer = vi.fn();
    setWebhookJobEnqueuer(enqueuer);

    prisma.webhookSubscription.findMany.mockResolvedValue([
      makeSub({ events: '["order.created","payment.refunded"]' }),
    ]);
    prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-1' });

    await dispatchWebhookEvent('order.created', { orderId: '123' });

    expect(prisma.webhookDelivery.create).toHaveBeenCalledOnce();
    expect(enqueuer).toHaveBeenCalledWith({ deliveryId: 'delivery-1' });
  });

  it('skips subscriptions that do not match the event', async () => {
    const enqueuer = vi.fn();
    setWebhookJobEnqueuer(enqueuer);

    prisma.webhookSubscription.findMany.mockResolvedValue([
      makeSub({ events: '["payment.refunded"]' }),
    ]);

    await dispatchWebhookEvent('order.created', {});
    expect(prisma.webhookDelivery.create).not.toHaveBeenCalled();
    expect(enqueuer).not.toHaveBeenCalled();
  });

  it('matches wildcard "*" subscriptions', async () => {
    const enqueuer = vi.fn();
    setWebhookJobEnqueuer(enqueuer);

    prisma.webhookSubscription.findMany.mockResolvedValue([
      makeSub({ events: '["*"]' }),
    ]);
    prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-2' });

    await dispatchWebhookEvent('order.cancelled', {});
    expect(enqueuer).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no active subscriptions match', async () => {
    prisma.webhookSubscription.findMany.mockResolvedValue([]);
    await dispatchWebhookEvent('order.created', {});
    expect(prisma.webhookDelivery.create).not.toHaveBeenCalled();
  });
});

describe('WEBHOOK_EVENTS', () => {
  it('includes the newly public-facing lifecycle events and excludes cart churn', () => {
    expect(WEBHOOK_EVENTS).toEqual(
      expect.arrayContaining([
        'order.updated',
        'order.fulfilled',
        'checkout.completed',
        'customer.registered',
        'product.created',
        'product.updated',
        'product.deleted',
      ])
    );
    expect(WEBHOOK_EVENTS).not.toContain('cart.created');
    expect(WEBHOOK_EVENTS).not.toContain('cart.itemAdded');
  });
});
