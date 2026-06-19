// app/core/store-credit/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    storeCreditLedger: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import prisma from '#/libs/prisma.server';

import {
  getStoreCreditBalance,
  issueStoreCredit,
  redeemStoreCredit,
  listLedgerEntries,
} from '#/core/store-credit/index.server';

describe('store-credit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('listLedgerEntries returns entries', async () => {
    prisma.storeCreditLedger.findMany.mockResolvedValue([{ id: 'e1' }]);
    const entries = await listLedgerEntries('cust-1');
    expect(entries).toHaveLength(1);
  });
});
