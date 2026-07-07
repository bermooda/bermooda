// app/core/back-in-stock/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    backInStockSubscription: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productVariant: { findUnique: vi.fn() },
  },
}));

vi.mock('#/emails/index.server', () => ({
  sendBackInStockEmail: vi.fn(),
}));

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('#/core/catalog/translations.server', () => ({
  loadProductTitleMap: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import { containsFilter } from '#/libs/prisma/filters.server';
import {
  buildSubscriptionWhere,
  deleteBackInStockSubscription,
  getBackInStockSubscription,
  listBackInStockSubscriptions,
  normalizeSubscriberEmail,
  notifyBackInStockSubscribers,
  parseDeleteSubscriptionFromForm,
  parseSubscribeFromForm,
  parseSubscribeInput,
  parseSubscriptionListParams,
  serializeBackInStockSubscription,
  subscribeBackInStock,
  SUBSCRIPTION_STATUSES,
} from '#/core/back-in-stock/index.server';
import { loadProductTitleMap } from '#/core/catalog/translations.server';
import { sendBackInStockEmail } from '#/emails/index.server';

beforeEach(() => {
  vi.clearAllMocks();
  loadProductTitleMap.mockResolvedValue(new Map());
});

describe('normalizeSubscriberEmail', () => {
  it('trims and lowercases email', () => {
    expect(normalizeSubscriberEmail(' Shop@Example.com ')).toBe(
      'shop@example.com'
    );
  });
});

describe('parseSubscriptionListParams', () => {
  it('parses pagination and filters', () => {
    const params = parseSubscriptionListParams(
      new URLSearchParams('page=2&limit=10&status=notified&variantId=v1&q=shop')
    );
    expect(params).toEqual({
      page: 2,
      limit: 10,
      status: 'notified',
      variantId: 'v1',
      q: 'shop',
    });
  });

  it('defaults status to pending', () => {
    expect(parseSubscriptionListParams({}).status).toBe('pending');
  });

  it('rejects invalid status filters', () => {
    expect(() => parseSubscriptionListParams({ status: 'bogus' })).toThrow(
      'Invalid subscription status filter'
    );
  });
});

describe('buildSubscriptionWhere', () => {
  it('filters pending subscriptions', () => {
    expect(buildSubscriptionWhere({ status: 'pending' })).toEqual({
      notifiedAt: null,
    });
  });

  it('filters notified subscriptions', () => {
    expect(buildSubscriptionWhere({ status: 'notified' })).toEqual({
      notifiedAt: { not: null },
    });
  });

  it('searches by normalized email', () => {
    expect(buildSubscriptionWhere({ q: 'Shop@Example.com' })).toEqual({
      notifiedAt: null,
      email: containsFilter('shop@example.com'),
    });
  });
});

describe('parseSubscribeInput', () => {
  it('normalizes subscribe payload', () => {
    expect(
      parseSubscribeInput({
        variantId: ' v1 ',
        email: ' Shop@Example.com ',
        customerId: ' cust-1 ',
      })
    ).toEqual({
      variantId: 'v1',
      email: 'shop@example.com',
      customerId: 'cust-1',
    });
  });

  it('requires email', () => {
    expect(() => parseSubscribeInput({ variantId: 'v1', email: '  ' })).toThrow(
      'Email is required'
    );
  });
});

describe('parseSubscribeFromForm', () => {
  it('reads variant and email from form data', () => {
    const formData = new FormData();
    formData.set('variantId', 'v1');
    formData.set('email', 'buyer@example.com');

    expect(parseSubscribeFromForm(formData, { customerId: 'cust-1' })).toEqual({
      variantId: 'v1',
      email: 'buyer@example.com',
      customerId: 'cust-1',
    });
  });
});

describe('parseDeleteSubscriptionFromForm', () => {
  it('parses delete intent', () => {
    const formData = new FormData();
    formData.set('intent', 'delete');
    formData.set('id', 'sub-1');

    expect(parseDeleteSubscriptionFromForm(formData)).toEqual({ id: 'sub-1' });
  });
});

describe('serializeBackInStockSubscription', () => {
  it('formats subscription payload', () => {
    const createdAt = new Date('2026-01-01T12:00:00.000Z');
    expect(
      serializeBackInStockSubscription(
        {
          id: 'sub-1',
          variantId: 'v1',
          customerId: null,
          email: 'buyer@example.com',
          notifiedAt: null,
          createdAt,
          variant: { id: 'v1', sku: 'SKU-1', productId: 'prod-1' },
        },
        { productTitle: 'Blue shirt' }
      )
    ).toMatchObject({
      id: 'sub-1',
      email: 'buyer@example.com',
      variantSku: 'SKU-1',
      productTitle: 'Blue shirt',
      notifiedAt: null,
      createdAt: createdAt.toISOString(),
    });
  });
});

describe('subscribeBackInStock', () => {
  it('upserts normalized subscription when variant exists', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({ id: 'v1' });
    prisma.backInStockSubscription.upsert.mockResolvedValue({ id: 's1' });

    await subscribeBackInStock({
      variantId: 'v1',
      email: ' Shop@Example.com ',
    });

    expect(prisma.backInStockSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          variantId_email: { variantId: 'v1', email: 'shop@example.com' },
        },
      })
    );
  });

  it('throws when variant is missing', async () => {
    prisma.productVariant.findUnique.mockResolvedValue(null);

    await expect(
      subscribeBackInStock({ variantId: 'missing', email: 'buyer@example.com' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('listBackInStockSubscriptions', () => {
  it('returns paginated serialized subscriptions', async () => {
    const createdAt = new Date('2026-01-01T12:00:00.000Z');
    prisma.backInStockSubscription.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        variantId: 'v1',
        customerId: null,
        email: 'buyer@example.com',
        notifiedAt: null,
        createdAt,
        variant: { id: 'v1', sku: 'SKU-1', productId: 'prod-1' },
        customer: null,
      },
    ]);
    prisma.backInStockSubscription.count.mockResolvedValue(1);
    loadProductTitleMap.mockResolvedValue(new Map([['prod-1', 'Blue shirt']]));

    const result = await listBackInStockSubscriptions({
      page: 1,
      limit: 20,
      status: 'pending',
    });

    expect(result.total).toBe(1);
    expect(result.subscriptions[0]).toMatchObject({
      id: 'sub-1',
      productTitle: 'Blue shirt',
    });
  });
});

describe('getBackInStockSubscription', () => {
  it('returns serialized subscription', async () => {
    const createdAt = new Date('2026-01-01T12:00:00.000Z');
    prisma.backInStockSubscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      variantId: 'v1',
      customerId: null,
      email: 'buyer@example.com',
      notifiedAt: null,
      createdAt,
      variant: { id: 'v1', sku: 'SKU-1', productId: 'prod-1' },
      customer: null,
    });
    loadProductTitleMap.mockResolvedValue(new Map([['prod-1', 'Blue shirt']]));

    const subscription = await getBackInStockSubscription('sub-1');
    expect(subscription.productTitle).toBe('Blue shirt');
  });

  it('throws when subscription is missing', async () => {
    prisma.backInStockSubscription.findUnique.mockResolvedValue(null);

    await expect(getBackInStockSubscription('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('deleteBackInStockSubscription', () => {
  it('deletes existing subscription', async () => {
    prisma.backInStockSubscription.findUnique.mockResolvedValue({
      id: 'sub-1',
    });
    prisma.backInStockSubscription.delete.mockResolvedValue({ id: 'sub-1' });

    await expect(deleteBackInStockSubscription('sub-1')).resolves.toEqual({
      deleted: true,
    });
  });
});

describe('notifyBackInStockSubscribers', () => {
  it('sends emails and marks notified', async () => {
    prisma.backInStockSubscription.findMany.mockResolvedValue([
      { id: 's1', email: 'buyer@example.com' },
    ]);
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'v1',
      sku: 'SKU-1',
      product: {},
    });
    sendBackInStockEmail.mockResolvedValue({ success: true });
    prisma.backInStockSubscription.update.mockResolvedValue({});

    const result = await notifyBackInStockSubscribers('v1');

    expect(result.notified).toBe(1);
    expect(sendBackInStockEmail).toHaveBeenCalledWith({
      to: 'buyer@example.com',
      variant: expect.objectContaining({ id: 'v1' }),
    });
  });
});

describe('SUBSCRIPTION_STATUSES', () => {
  it('includes pending, notified, and all', () => {
    expect(SUBSCRIPTION_STATUSES).toEqual(['pending', 'notified', 'all']);
  });
});
