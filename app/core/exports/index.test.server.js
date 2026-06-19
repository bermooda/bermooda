// app/core/exports/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    order: { findMany: vi.fn() },
    productVariant: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
    translation: { findMany: vi.fn() },
    scheduledExport: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    exportRun: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (ops) => {
      if (typeof ops === 'function') return ops(prisma);
      return Promise.all(ops);
    }),
  },
}));

import prisma from '#/libs/prisma.server';

import {
  buildCsv,
  csvCell,
  exportOrdersCsv,
  createScheduledExport,
  runScheduledExport,
} from '#/core/exports/index.server';

describe('exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('csvCell escapes commas and quotes', () => {
    expect(csvCell('hello')).toBe('hello');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('buildCsv produces header + rows', () => {
    const csv = buildCsv(
      ['a', 'b'],
      [
        [1, 2],
        [3, 4],
      ]
    );
    expect(csv).toBe('a,b\n1,2\n3,4');
  });

  it('exportOrdersCsv returns order rows', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        orderNumber: '1001',
        email: 'buyer@test.com',
        status: 'paid',
        currency: 'USD',
        subtotalCents: 2000,
        shippingCents: 500,
        taxCents: 100,
        discountCents: 0,
        totalCents: 2600,
        paymentProvider: 'stripe',
        createdAt: new Date('2026-01-15'),
      },
    ]);

    const { csv, rowCount } = await exportOrdersCsv({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(rowCount).toBe(1);
    expect(csv).toContain('1001');
    expect(csv).toContain('buyer@test.com');
  });

  it('createScheduledExport validates export type', async () => {
    prisma.scheduledExport.create.mockResolvedValue({ id: 'exp-1' });

    await createScheduledExport({
      label: 'Daily orders',
      exportType: 'orders',
      schedule: 'daily',
    });

    expect(prisma.scheduledExport.create).toHaveBeenCalled();
  });

  it('runScheduledExport stores completed CSV', async () => {
    prisma.scheduledExport.findUnique.mockResolvedValue({
      id: 'exp-1',
      exportType: 'customers',
      filtersJson: null,
      active: true,
    });
    prisma.exportRun.create.mockResolvedValue({ id: 'run-1' });
    prisma.customer.findMany.mockResolvedValue([
      {
        id: 'c1',
        email: 'a@b.com',
        name: 'A',
        phone: null,
        preferredLocale: null,
        createdAt: new Date(),
      },
    ]);
    prisma.exportRun.update.mockResolvedValue({});
    prisma.scheduledExport.update.mockResolvedValue({});

    const result = await runScheduledExport('exp-1');

    expect(result.runId).toBe('run-1');
    expect(prisma.exportRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'completed',
        rowCount: 1,
        fileContent: expect.stringContaining('a@b.com'),
      }),
    });
  });
});
