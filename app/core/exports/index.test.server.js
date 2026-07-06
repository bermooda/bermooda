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
      count: vi.fn(),
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
  deleteScheduledExport,
  getExportRun,
  getScheduledExport,
  listScheduledExports,
  parseCreateScheduledExportInput,
  parseExportDownloadParams,
  resolveExportDownload,
  runScheduledExport,
  validateExportType,
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

  it('validateExportType rejects unknown types', () => {
    expect(() => validateExportType('orders')).not.toThrow();
    expect(() => validateExportType('unknown')).toThrow(/Invalid export type/);
  });

  it('parseExportDownloadParams reads query params', () => {
    const params = new URLSearchParams('type=orders&startDate=2026-01-01');
    expect(parseExportDownloadParams(params)).toEqual({
      type: 'orders',
      startDate: '2026-01-01',
    });
  });

  it('parseCreateScheduledExportInput validates required fields', () => {
    expect(() =>
      parseCreateScheduledExportInput({
        label: 'Daily orders',
        exportType: 'orders',
        schedule: 'daily',
      })
    ).not.toThrow();

    expect(() =>
      parseCreateScheduledExportInput({ label: 'Missing fields' })
    ).toThrow(/required/i);
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

  it('createScheduledExport stores a scheduled export', async () => {
    prisma.scheduledExport.create.mockResolvedValue({
      id: 'exp-1',
      label: 'Daily orders',
      exportType: 'orders',
      schedule: 'daily',
      filtersJson: null,
      recipientEmail: null,
      active: true,
      lastRunAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

    const created = await createScheduledExport({
      label: 'Daily orders',
      exportType: 'orders',
      schedule: 'daily',
    });

    expect(created.id).toBe('exp-1');
    expect(prisma.scheduledExport.create).toHaveBeenCalled();
  });

  it('listScheduledExports returns paginated scheduled exports', async () => {
    prisma.scheduledExport.findMany.mockResolvedValue([
      {
        id: 'exp-1',
        label: 'Daily orders',
        exportType: 'orders',
        schedule: 'daily',
        filtersJson: null,
        recipientEmail: null,
        active: true,
        lastRunAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        runs: [],
      },
    ]);
    prisma.scheduledExport.count.mockResolvedValue(1);

    const result = await listScheduledExports({ page: 1, limit: 50 });

    expect(result.total).toBe(1);
    expect(result.scheduledExports).toHaveLength(1);
    expect(result.scheduledExports[0].label).toBe('Daily orders');
  });

  it('getScheduledExport throws when missing', async () => {
    prisma.scheduledExport.findUnique.mockResolvedValue(null);

    await expect(getScheduledExport('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('deleteScheduledExport throws when missing', async () => {
    prisma.scheduledExport.findUnique.mockResolvedValue(null);

    await expect(deleteScheduledExport('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('getExportRun throws when missing', async () => {
    prisma.exportRun.findUnique.mockResolvedValue(null);

    await expect(getExportRun('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('resolveExportDownload returns immediate export CSV', async () => {
    prisma.order.findMany.mockResolvedValue([]);

    const result = await resolveExportDownload({
      type: 'orders',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(result.csv).toContain('order_number');
    expect(result.filename).toMatch(/^orders-export-/);
    expect(result.rowCount).toBe(0);
  });

  it('resolveExportDownload returns stored run CSV', async () => {
    prisma.exportRun.findUnique.mockResolvedValue({
      id: 'run-1',
      scheduledExportId: 'exp-1',
      exportType: 'customers',
      status: 'completed',
      rowCount: 1,
      fileContent: 'id,email\n1,a@b.com',
      error: null,
      createdAt: new Date('2026-01-01'),
      completedAt: new Date('2026-01-01'),
    });

    const result = await resolveExportDownload({ runId: 'run-1' });

    expect(result.csv).toContain('a@b.com');
    expect(result.filename).toBe('customers-export-run-1.csv');
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
