// app/core/gift-cards/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    giftCard: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    giftCardRedemption: { create: vi.fn() },
  },
}));

import prisma from '#/libs/prisma.server';

import {
  buildGiftCardSearchWhere,
  getGiftCardByCode,
  issueGiftCard,
  listGiftCards,
  normalizeGiftCardCode,
  parseIssueGiftCardInput,
  redeemGiftCard,
  resolveGiftCardRedemption,
} from '#/core/gift-cards/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('normalizeGiftCardCode', () => {
  it('trims and uppercases codes', () => {
    expect(normalizeGiftCardCode('  save50  ')).toBe('SAVE50');
  });
});

describe('buildGiftCardSearchWhere', () => {
  it('returns empty object for blank query', () => {
    expect(buildGiftCardSearchWhere('')).toEqual({});
  });

  it('builds a normalized code filter', () => {
    const where = buildGiftCardSearchWhere('welcome');
    expect(where.code.contains).toBe('WELCOME');
  });
});

describe('parseIssueGiftCardInput', () => {
  it('normalizes form payload fields', () => {
    expect(
      parseIssueGiftCardInput({
        code: ' save50 ',
        balanceCents: '2500',
        currency: 'eur',
      })
    ).toEqual({
      code: 'SAVE50',
      balanceCents: 2500,
      currency: 'EUR',
      customerId: null,
      expiresAt: null,
    });
  });

  it('leaves code null when blank', () => {
    expect(
      parseIssueGiftCardInput({ balanceCents: 1000, code: '   ' }).code
    ).toBe(null);
  });
});

describe('issueGiftCard', () => {
  it('rejects invalid amount', async () => {
    await expect(issueGiftCard({ balanceCents: 0 })).rejects.toThrow(
      'INVALID_GIFT_CARD_AMOUNT'
    );
  });

  it('rejects duplicate codes', async () => {
    prisma.giftCard.findUnique.mockResolvedValue({ id: 'gc-existing' });

    await expect(
      issueGiftCard({ code: 'DUPLICATE', balanceCents: 1000 })
    ).rejects.toMatchObject({ code: 'GIFT_CARD_CODE_EXISTS' });
  });

  it('creates a gift card with normalized code', async () => {
    prisma.giftCard.findUnique.mockResolvedValue(null);
    prisma.giftCard.create.mockResolvedValue({
      id: 'gc1',
      code: 'SAVE50',
      balanceCents: 5000,
    });

    const giftCard = await issueGiftCard({
      code: 'save50',
      balanceCents: 5000,
      currency: 'usd',
    });

    expect(prisma.giftCard.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'SAVE50',
        balanceCents: 5000,
        currency: 'USD',
      }),
    });
    expect(giftCard.code).toBe('SAVE50');
  });
});

describe('getGiftCardByCode', () => {
  it('normalizes code and rejects expired cards', async () => {
    prisma.giftCard.findUnique.mockResolvedValue({
      id: 'gc1',
      status: 'active',
      balanceCents: 500,
      currency: 'USD',
      expiresAt: new Date('2020-01-01'),
    });

    const card = await getGiftCardByCode('abc123', 'USD');
    expect(prisma.giftCard.findUnique).toHaveBeenCalledWith({
      where: { code: 'ABC123' },
    });
    expect(card).toBeNull();
  });

  it('returns active cards with matching currency', async () => {
    prisma.giftCard.findUnique.mockResolvedValue({
      id: 'gc1',
      status: 'active',
      balanceCents: 500,
      currency: 'USD',
      expiresAt: null,
    });

    const card = await getGiftCardByCode('abc123', 'USD');
    expect(card.id).toBe('gc1');
  });
});

describe('listGiftCards', () => {
  it('applies search and pagination', async () => {
    prisma.giftCard.findMany.mockResolvedValue([{ id: 'gc1' }]);
    prisma.giftCard.count.mockResolvedValue(1);

    const result = await listGiftCards({ page: 2, limit: 10, q: 'welcome' });

    expect(prisma.giftCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: expect.objectContaining({ contains: 'WELCOME' }) },
        skip: 10,
        take: 10,
      })
    );
    expect(result).toEqual({ giftCards: [{ id: 'gc1' }], total: 1 });
  });
});

describe('resolveGiftCardRedemption', () => {
  it('caps at order total', async () => {
    prisma.giftCard.findUnique.mockResolvedValue({
      id: 'gc1',
      status: 'active',
      balanceCents: 5000,
      currency: 'USD',
      expiresAt: null,
    });

    const result = await resolveGiftCardRedemption('SAVE50', 'USD', 1200);
    expect(result.amountCents).toBe(1200);
  });
});

describe('redeemGiftCard', () => {
  it('updates balance and creates redemption', async () => {
    prisma.giftCard.findUnique.mockResolvedValue({
      id: 'gc1',
      status: 'active',
      balanceCents: 2000,
      expiresAt: null,
    });
    prisma.giftCard.update.mockResolvedValue({ id: 'gc1', balanceCents: 1500 });
    prisma.giftCardRedemption.create.mockResolvedValue({ id: 'r1' });

    await redeemGiftCard('gc1', { amountCents: 500, orderId: 'ord-1' });

    expect(prisma.giftCard.update).toHaveBeenCalledWith({
      where: { id: 'gc1' },
      data: { balanceCents: 1500, status: 'active' },
    });
    expect(prisma.giftCardRedemption.create).toHaveBeenCalled();
  });

  it('rejects expired cards at redemption time', async () => {
    prisma.giftCard.findUnique.mockResolvedValue({
      id: 'gc1',
      status: 'active',
      balanceCents: 2000,
      expiresAt: new Date('2020-01-01'),
    });

    await expect(
      redeemGiftCard('gc1', { amountCents: 500, orderId: 'ord-1' })
    ).rejects.toThrow('GIFT_CARD_INVALID');
  });
});
