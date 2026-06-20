// app/core/gift-cards/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    giftCard: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    giftCardRedemption: { create: vi.fn() },
  },
}));

import prisma from '#/libs/prisma.server';

import {
  getGiftCardByCode,
  issueGiftCard,
  redeemGiftCard,
  resolveGiftCardRedemption,
} from '#/core/gift-cards/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('gift cards', () => {
  it('issueGiftCard rejects invalid amount', async () => {
    await expect(issueGiftCard({ balanceCents: 0 })).rejects.toThrow(
      'INVALID_GIFT_CARD_AMOUNT'
    );
  });

  it('getGiftCardByCode normalizes code', async () => {
    prisma.giftCard.findUnique.mockResolvedValue({
      id: 'gc1',
      status: 'active',
      balanceCents: 500,
      currency: 'USD',
      expiresAt: null,
    });

    const card = await getGiftCardByCode('abc123', 'USD');
    expect(prisma.giftCard.findUnique).toHaveBeenCalledWith({
      where: { code: 'ABC123' },
    });
    expect(card.id).toBe('gc1');
  });

  it('resolveGiftCardRedemption caps at order total', async () => {
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

  it('redeemGiftCard updates balance and creates redemption', async () => {
    prisma.giftCard.findUnique.mockResolvedValue({
      id: 'gc1',
      status: 'active',
      balanceCents: 2000,
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
});
