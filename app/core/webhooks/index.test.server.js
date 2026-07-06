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
    count: vi.fn(),
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
import { DOMAIN_EVENT_WILDCARD } from '#/core/events/names';

import {
  buildWebhookDispatchPayload,
  createSubscription,
  deleteSubscription,
  dispatchWebhookEvent,
  getSubscription,
  listDeliveries,
  listSubscriptions,
  parseCreateSubscriptionInput,
  parseSubscriptionEvents,
  parseUpdateSubscriptionInput,
  setWebhookJobEnqueuer,
  subscriptionMatchesEvent,
  updateSubscription,
  validateSubscriptionEvents,
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

describe('parseSubscriptionEvents', () => {
  it('parses JSON strings and arrays', () => {
    expect(parseSubscriptionEvents('["order.created"]')).toEqual([
      'order.created',
    ]);
    expect(parseSubscriptionEvents(['payment.refunded'])).toEqual([
      'payment.refunded',
    ]);
  });

  it('returns an empty array for blank input', () => {
    expect(parseSubscriptionEvents('')).toEqual([]);
    expect(parseSubscriptionEvents(null)).toEqual([]);
  });
});

describe('validateSubscriptionEvents', () => {
  it('accepts supported events and wildcard', () => {
    expect(() =>
      validateSubscriptionEvents(['order.created', 'payment.refunded'])
    ).not.toThrow();
    expect(() => validateSubscriptionEvents(['*'])).not.toThrow();
  });

  it('throws EVENTS_REQUIRED for empty arrays', () => {
    expect(() => validateSubscriptionEvents([])).toThrow(
      expect.objectContaining({ code: 'EVENTS_REQUIRED' })
    );
  });

  it('throws EVENTS_INVALID for unknown events', () => {
    expect(() => validateSubscriptionEvents(['cart.created'])).toThrow(
      expect.objectContaining({ code: 'EVENTS_INVALID' })
    );
  });
});

describe('parseCreateSubscriptionInput', () => {
  it('normalizes create payload fields', () => {
    expect(
      parseCreateSubscriptionInput({
        url: ' https://example.com/hook ',
        secret: ' whsec_test ',
        label: ' ERP ',
        events: ['order.created'],
      })
    ).toEqual({
      url: 'https://example.com/hook',
      secret: 'whsec_test',
      label: 'ERP',
      events: ['order.created'],
    });
  });
});

describe('parseUpdateSubscriptionInput', () => {
  it('parses active and label updates', () => {
    expect(
      parseUpdateSubscriptionInput({ active: 'on', label: '  Prod ' })
    ).toEqual({
      active: true,
      label: 'Prod',
    });
  });
});

describe('subscriptionMatchesEvent', () => {
  it('matches explicit events and wildcard subscriptions', () => {
    expect(subscriptionMatchesEvent(['order.created'], 'order.created')).toBe(
      true
    );
    expect(
      subscriptionMatchesEvent(['payment.refunded'], 'order.created')
    ).toBe(false);
    expect(
      subscriptionMatchesEvent([DOMAIN_EVENT_WILDCARD], 'order.created')
    ).toBe(true);
  });
});

describe('buildWebhookDispatchPayload', () => {
  it('builds a JSON payload with event, data, and timestamp', () => {
    const payload = JSON.parse(
      buildWebhookDispatchPayload('order.created', { orderId: '123' })
    );
    expect(payload.event).toBe('order.created');
    expect(payload.data).toEqual({ orderId: '123' });
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

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

  it('throws EVENTS_INVALID for unsupported events', async () => {
    await expect(
      createSubscription({
        url: 'https://x.com',
        events: ['cart.created'],
        secret: 'secret',
      })
    ).rejects.toMatchObject({ code: 'EVENTS_INVALID' });
  });
});

// ---------------------------------------------------------------------------

describe('listSubscriptions', () => {
  it('returns paginated subscriptions with events parsed as arrays', async () => {
    prisma.webhookSubscription.findMany.mockResolvedValue([
      makeSub({ id: '1', events: '["order.created"]' }),
      makeSub({ id: '2', events: '["payment.refunded"]' }),
    ]);
    prisma.webhookSubscription.count.mockResolvedValue(2);

    const result = await listSubscriptions({ page: 1, limit: 20 });
    expect(result.subscriptions).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    for (const sub of result.subscriptions) {
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

describe('updateSubscription', () => {
  it('updates active state and returns serialized subscription', async () => {
    prisma.webhookSubscription.findUnique.mockResolvedValue(makeSub());
    prisma.webhookSubscription.update.mockResolvedValue(
      makeSub({ active: false })
    );

    const result = await updateSubscription('sub-1', { active: false });
    expect(result.active).toBe(false);
    expect(prisma.webhookSubscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { active: false },
    });
  });
});

// ---------------------------------------------------------------------------

describe('deleteSubscription', () => {
  it('calls prisma.webhookSubscription.delete after lookup', async () => {
    prisma.webhookSubscription.findUnique.mockResolvedValue(makeSub());
    prisma.webhookSubscription.delete.mockResolvedValue({});
    await deleteSubscription('sub-1');
    expect(prisma.webhookSubscription.delete).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
    });
  });

  it('throws NOT_FOUND when subscription does not exist', async () => {
    prisma.webhookSubscription.findUnique.mockResolvedValue(null);
    await expect(deleteSubscription('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(prisma.webhookSubscription.delete).not.toHaveBeenCalled();
  });
});

describe('listDeliveries', () => {
  it('throws NOT_FOUND when subscription does not exist', async () => {
    prisma.webhookSubscription.findUnique.mockResolvedValue(null);
    await expect(listDeliveries('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
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
