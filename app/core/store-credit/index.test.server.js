// app/core/store-credit/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    storeCreditLedger: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import prisma from '#/libs/prisma.server';
import {
  getCustomerStoreCreditSummary,
  getStoreCreditBalance,
  issueStoreCredit,
  listLedgerEntries,
  parseIssueStoreCreditInput,
  redeemStoreCredit,
  resolveStoreCreditRedemption,
} from '#/core/store-credit/index.server';

describe('store-credit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseIssueStoreCreditInput', () => {
    it('parses admin form values', () => {
      expect(
        parseIssueStoreCreditInput({
          amountCents: '2500',
          reason: ' Goodwill ',
          referenceType: 'admin',
          referenceId: 'user-1',
        })
      ).toEqual({
        amountCents: 2500,
        reason: 'Goodwill',
        referenceType: 'admin',
        referenceId: 'user-1',
      });
    });

    it('defaults missing fields to null', () => {
      expect(parseIssueStoreCreditInput({ amountCents: 100 })).toEqual({
        amountCents: 100,
        reason: null,
        referenceType: null,
        referenceId: null,
      });
    });
  });

  it('getStoreCreditBalance returns 0 when no entries', async () => {
    prisma.storeCreditLedger.findFirst.mockResolvedValue(null);
    expect(await getStoreCreditBalance('cust-1')).toBe(0);
  });

  it('getStoreCreditBalance returns latest balance', async () => {
    prisma.storeCreditLedger.findFirst.mockResolvedValue({
      balanceAfterCents: 1500,
    });
    expect(await getStoreCreditBalance('cust-1')).toBe(1500);
  });

  it('getCustomerStoreCreditSummary returns zero without customer', async () => {
    expect(await getCustomerStoreCreditSummary()).toEqual({ balance: 0 });
  });

  it('getCustomerStoreCreditSummary returns balance', async () => {
    prisma.storeCreditLedger.findFirst.mockResolvedValue({
      balanceAfterCents: 900,
    });
    expect(await getCustomerStoreCreditSummary('cust-1')).toEqual({
      balance: 900,
    });
  });

  it('issueStoreCredit creates positive ledger entry', async () => {
    prisma.storeCreditLedger.findFirst.mockResolvedValue(null);
    prisma.storeCreditLedger.create.mockResolvedValue({
      id: 'entry-1',
      balanceAfterCents: 1000,
    });

    const entry = await issueStoreCredit('cust-1', {
      amountCents: 1000,
      reason: 'Return',
      referenceType: 'return',
      referenceId: 'ret-1',
    });

    expect(entry.balanceAfterCents).toBe(1000);
    expect(prisma.storeCreditLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: 'cust-1',
        amountCents: 1000,
        balanceAfterCents: 1000,
      }),
    });
  });

  it('issueStoreCredit rejects invalid amount', async () => {
    await expect(
      issueStoreCredit('cust-1', { amountCents: 0 })
    ).rejects.toThrow('INVALID_CREDIT_AMOUNT');
  });

  it('redeemStoreCredit creates negative ledger entry', async () => {
    prisma.storeCreditLedger.findFirst.mockResolvedValue({
      balanceAfterCents: 2000,
    });
    prisma.storeCreditLedger.create.mockResolvedValue({
      id: 'entry-2',
      balanceAfterCents: 1500,
    });

    const entry = await redeemStoreCredit('cust-1', { amountCents: 500 });
    expect(entry.balanceAfterCents).toBe(1500);
    expect(prisma.storeCreditLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountCents: -500,
        balanceAfterCents: 1500,
      }),
    });
  });

  it('redeemStoreCredit rejects insufficient balance', async () => {
    prisma.storeCreditLedger.findFirst.mockResolvedValue({
      balanceAfterCents: 100,
    });
    await expect(
      redeemStoreCredit('cust-1', { amountCents: 500 })
    ).rejects.toThrow('INSUFFICIENT_STORE_CREDIT');
  });

  it('listLedgerEntries returns paginated entries', async () => {
    prisma.storeCreditLedger.findMany.mockResolvedValue([{ id: 'e1' }]);
    prisma.storeCreditLedger.count.mockResolvedValue(1);

    const result = await listLedgerEntries('cust-1');
    expect(result).toEqual({ entries: [{ id: 'e1' }], total: 1 });
  });

  describe('resolveStoreCreditRedemption', () => {
    it('caps redemption by balance and remaining total', async () => {
      prisma.storeCreditLedger.findFirst.mockResolvedValue({
        balanceAfterCents: 2000,
      });

      const result = await resolveStoreCreditRedemption('cust-1', 1500, 1000);
      expect(result).toEqual({ storeCreditCents: 1000 });
    });

    it('returns zero when no customer or remaining total', async () => {
      expect(await resolveStoreCreditRedemption(null, 500, 1000)).toEqual({
        storeCreditCents: 0,
      });
      expect(await resolveStoreCreditRedemption('cust-1', 500, 0)).toEqual({
        storeCreditCents: 0,
      });
    });
  });
});
