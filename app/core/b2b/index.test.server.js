import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    company: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    companyMember: {
      create: vi.fn(),
    },
    quote: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    quoteLine: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('#/libs/prisma.server', () => ({
  default: prismaMock,
}));

import {
  createCompany,
  createQuote,
  listCompanies,
  sendQuote,
} from '#/core/b2b/index.server';

describe('b2b core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createCompany persists company data', async () => {
    prismaMock.company.create.mockResolvedValue({
      id: 'co_1',
      name: 'Acme',
      netTermsDays: 30,
    });

    const company = await createCompany({
      name: 'Acme',
      netTermsDays: 30,
    });

    expect(company.name).toBe('Acme');
    expect(prismaMock.company.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Acme', netTermsDays: 30 }),
    });
  });

  it('createQuote creates lines and totals', async () => {
    prismaMock.$transaction.mockImplementation(async (fn) => fn(prismaMock));
    prismaMock.quote.create.mockResolvedValue({
      id: 'quo_1',
      quoteNumber: 'QUO-1',
    });
    prismaMock.quote.update.mockResolvedValue({
      id: 'quo_1',
      subtotalCents: 2000,
      totalCents: 2000,
    });
    prismaMock.quote.findUnique.mockResolvedValue({
      id: 'quo_1',
      lines: [],
    });

    await createQuote({
      companyId: 'co_1',
      lines: [{ variantId: 'var_1', quantity: 2, priceCents: 1000 }],
    });

    expect(prismaMock.quoteLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        variantId: 'var_1',
        quantity: 2,
        priceCents: 1000,
      }),
    });
    expect(prismaMock.quote.update).toHaveBeenCalledWith({
      where: { id: 'quo_1' },
      data: { subtotalCents: 2000, totalCents: 2000 },
    });
  });

  it('sendQuote updates status to sent', async () => {
    prismaMock.quote.update.mockResolvedValue({ id: 'quo_1', status: 'sent' });

    await sendQuote('quo_1');

    expect(prismaMock.quote.update).toHaveBeenCalledWith({
      where: { id: 'quo_1' },
      data: { status: 'sent' },
    });
  });

  it('listCompanies returns companies with counts', async () => {
    prismaMock.company.findMany.mockResolvedValue([
      { id: 'co_1', name: 'Acme' },
    ]);

    const companies = await listCompanies();

    expect(companies).toHaveLength(1);
    expect(prismaMock.company.findMany).toHaveBeenCalled();
  });
});
