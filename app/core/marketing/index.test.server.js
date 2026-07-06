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
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    marketingCampaign: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    campaignDelivery: { findUnique: vi.fn(), upsert: vi.fn() },
    abandonedCartSequence: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
  createSegment,
  customerMatchesSegment,
  getSegment,
  parseCreateCampaignInput,
  parseCreateAbandonedCartSequenceInput,
  parseCreateSegmentInput,
  parseSegmentRules,
  parseSegmentRulesFromForm,
  parseSegmentRulesInput,
  parseUpdateAbandonedCartSequenceInput,
} from '#/core/marketing/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('marketing parsers', () => {
  it('parseSegmentRules returns empty object for invalid JSON', () => {
    expect(parseSegmentRules('not-json')).toEqual({});
  });

  it('parseSegmentRulesInput normalizes numeric rules', () => {
    expect(
      parseSegmentRulesInput({
        minOrders: '3',
        minSpentCents: '10000',
        customerGroupId: ' g1 ',
      })
    ).toEqual({
      minOrders: 3,
      minSpentCents: 10000,
      customerGroupId: 'g1',
    });
  });

  it('parseSegmentRulesFromForm reads form fields', () => {
    const formData = new FormData();
    formData.set('minOrders', '2');
    formData.set('minSpentCents', '5000');
    formData.set('customerGroupId', 'group-1');

    expect(parseSegmentRulesFromForm(formData)).toEqual({
      minOrders: 2,
      minSpentCents: 5000,
      customerGroupId: 'group-1',
    });
  });

  it('parseCreateSegmentInput requires a name', () => {
    expect(() => parseCreateSegmentInput({})).toThrow(/name is required/i);
  });

  it('parseCreateCampaignInput requires all fields', () => {
    expect(() =>
      parseCreateCampaignInput({ segmentId: 's1', name: 'Sale' })
    ).toThrow(/required/i);
  });

  it('parseCreateAbandonedCartSequenceInput validates delay', () => {
    expect(() =>
      parseCreateAbandonedCartSequenceInput({
        name: 'Reminder',
        subject: 'Come back',
        delayMinutes: 0,
      })
    ).toThrow(/delay/i);
  });

  it('parseUpdateAbandonedCartSequenceInput parses active flag', () => {
    expect(parseUpdateAbandonedCartSequenceInput({ active: 'true' })).toEqual({
      active: true,
    });
  });
});

describe('marketing segment matching', () => {
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

describe('marketing segment CRUD', () => {
  it('getSegment throws NOT_FOUND when missing', async () => {
    prisma.marketingSegment.findUnique.mockResolvedValue(null);

    await expect(getSegment('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('createSegment stores parsed rules JSON', async () => {
    prisma.marketingSegment.create.mockResolvedValue({
      id: 'seg-1',
      name: 'VIP',
      rulesJson: '{"minOrders":2}',
      _count: { campaigns: 0 },
    });

    const segment = await createSegment({
      name: 'VIP',
      rules: { minOrders: 2 },
    });

    expect(prisma.marketingSegment.create).toHaveBeenCalledWith({
      data: {
        name: 'VIP',
        rulesJson: '{"minOrders":2}',
      },
      include: { _count: { select: { campaigns: true } } },
    });
    expect(segment.rules).toEqual({ minOrders: 2 });
  });
});
