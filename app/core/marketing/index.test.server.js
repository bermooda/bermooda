// app/core/marketing/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    customerGroupMember: { findUnique: vi.fn() },
    order: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
    marketingSegment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    marketingCampaign: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    campaignDelivery: { findUnique: vi.fn(), upsert: vi.fn() },
    abandonedCartSequence: {
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
    },
    abandonedCartSend: { findUnique: vi.fn(), create: vi.fn() },
    cart: { findMany: vi.fn() },
  },
}));

vi.mock('#/emails/index.server', () => ({
  sendCampaignEmail: vi.fn(),
}));

vi.mock('#/emails/job.server', () => ({
  queueAbandonedCart: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import {
  customerMatchesSegment,
  parseSegmentRules,
} from '#/core/marketing/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('marketing', () => {
  it('parseSegmentRules returns empty object for invalid JSON', () => {
    expect(parseSegmentRules('not-json')).toEqual({});
  });

  it('customerMatchesSegment checks minOrders', async () => {
    prisma.customerGroupMember.findUnique.mockResolvedValue(null);
    prisma.order.findMany.mockResolvedValue([{ totalCents: 100 }]);

    const match = await customerMatchesSegment('c1', { minOrders: 2 });
    expect(match).toBe(false);
  });

  it('customerMatchesSegment passes when rules empty', async () => {
    const match = await customerMatchesSegment('c1', {});
    expect(match).toBe(true);
  });

  it('customerMatchesSegment checks customer group', async () => {
    prisma.customerGroupMember.findUnique.mockResolvedValue(null);
    const match = await customerMatchesSegment('c1', {
      customerGroupId: 'g1',
    });
    expect(match).toBe(false);
    expect(prisma.customerGroupMember.findUnique).toHaveBeenCalled();
  });
});
