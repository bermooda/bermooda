import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    company: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    companyMember: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    customer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    productVariant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    quote: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
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
  addCompanyMember,
  buildCompanyWhere,
  buildQuoteWhere,
  createCompany,
  createQuote,
  formatQuoteMoney,
  getCompany,
  getQuote,
  listCompanies,
  listQuotes,
  parseAddCompanyMemberInput,
  parseCompanyListParams,
  parseCreateCompanyInput,
  parseCreateQuoteInput,
  parseQuoteListParams,
  parseUpdateQuoteStatusInput,
  sendQuote,
  serializeCompany,
  serializeQuote,
} from '#/core/b2b/index.server';

describe('b2b core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parseCreateCompanyInput requires name', () => {
    expect(() => parseCreateCompanyInput({})).toThrow(
      /Company name is required/
    );
  });

  it('parseQuoteListParams rejects invalid status', () => {
    expect(() => parseQuoteListParams({ status: 'bogus' })).toThrow(
      /Invalid quote status filter/
    );
  });

  it('buildCompanyWhere applies search and active filters', () => {
    const where = buildCompanyWhere({ q: 'acme', active: true });
    expect(where.active).toBe(true);
    expect(where.OR).toHaveLength(2);
  });

  it('buildQuoteWhere applies quote filters', () => {
    expect(buildQuoteWhere({ companyId: 'co_1', status: 'draft' })).toEqual({
      companyId: 'co_1',
      status: 'draft',
    });
  });

  it('serializeCompany includes counts', () => {
    const serialized = serializeCompany({
      id: 'co_1',
      name: 'Acme',
      taxId: null,
      netTermsDays: 30,
      active: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      _count: { members: 2, quotes: 1 },
    });

    expect(serialized.memberCount).toBe(2);
    expect(serialized.quoteCount).toBe(1);
  });

  it('formatQuoteMoney formats cents', () => {
    expect(formatQuoteMoney(1999, 'USD')).toContain('19.99');
  });

  it('createCompany persists company data', async () => {
    prismaMock.company.create.mockResolvedValue({
      id: 'co_1',
      name: 'Acme',
      taxId: null,
      netTermsDays: 30,
      active: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
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

  it('listCompanies returns paginated payload', async () => {
    prismaMock.company.findMany.mockResolvedValue([
      {
        id: 'co_1',
        name: 'Acme',
        taxId: null,
        netTermsDays: 30,
        active: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        _count: { members: 1, quotes: 0 },
      },
    ]);
    prismaMock.company.count.mockResolvedValue(1);

    const result = await listCompanies(parseCompanyListParams({ page: '1' }));

    expect(result.companies).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('getCompany throws when missing', async () => {
    prismaMock.company.findUnique.mockResolvedValue(null);

    await expect(getCompany('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('addCompanyMember rejects duplicate members', async () => {
    prismaMock.company.findUnique.mockResolvedValue({ id: 'co_1' });
    prismaMock.customer.findUnique.mockResolvedValue({ id: 'cus_1' });
    prismaMock.companyMember.findUnique.mockResolvedValue({ id: 'mem_1' });

    expect(() =>
      parseAddCompanyMemberInput({
        companyId: 'co_1',
        customerId: 'cus_1',
      })
    ).not.toThrow();

    await expect(
      addCompanyMember({ companyId: 'co_1', customerId: 'cus_1' })
    ).rejects.toMatchObject({ code: 'MEMBER_EXISTS' });
  });

  it('createQuote creates lines and totals', async () => {
    prismaMock.company.findUnique.mockResolvedValue({ id: 'co_1' });
    prismaMock.productVariant.findUnique.mockResolvedValue({
      id: 'var_1',
      sku: 'SKU-1',
      product: { title: 'Widget' },
    });
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
      quoteNumber: 'QUO-1',
      companyId: 'co_1',
      customerId: null,
      status: 'draft',
      currency: 'USD',
      subtotalCents: 2000,
      totalCents: 2000,
      notes: null,
      orderId: null,
      expiresAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      company: { id: 'co_1', name: 'Acme', netTermsDays: 30 },
      customer: null,
      lines: [],
    });

    const quote = await createQuote(
      parseCreateQuoteInput({
        companyId: 'co_1',
        lines: [{ variantId: 'var_1', quantity: 2, priceCents: 1000 }],
      })
    );

    expect(prismaMock.quoteLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        variantId: 'var_1',
        quantity: 2,
        priceCents: 1000,
        titleSnapshot: 'Widget',
      }),
    });
    expect(quote.totalCents).toBe(2000);
  });

  it('listQuotes returns serialized quotes', async () => {
    prismaMock.quote.findMany.mockResolvedValue([
      {
        id: 'quo_1',
        quoteNumber: 'QUO-1',
        companyId: 'co_1',
        customerId: null,
        status: 'draft',
        currency: 'USD',
        subtotalCents: 1000,
        totalCents: 1000,
        notes: null,
        orderId: null,
        expiresAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        company: { id: 'co_1', name: 'Acme' },
        customer: null,
        _count: { lines: 1 },
      },
    ]);
    prismaMock.quote.count.mockResolvedValue(1);

    const result = await listQuotes();

    expect(result.quotes[0].formattedTotal).toContain('10.00');
    expect(result.total).toBe(1);
  });

  it('getQuote throws when missing', async () => {
    prismaMock.quote.findUnique.mockResolvedValue(null);

    await expect(getQuote('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('sendQuote updates status to sent', async () => {
    prismaMock.quote.findUnique.mockResolvedValue({ id: 'quo_1' });
    prismaMock.quote.update.mockResolvedValue({
      id: 'quo_1',
      quoteNumber: 'QUO-1',
      companyId: 'co_1',
      customerId: null,
      status: 'sent',
      currency: 'USD',
      subtotalCents: 1000,
      totalCents: 1000,
      notes: null,
      orderId: null,
      expiresAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      company: { id: 'co_1', name: 'Acme', netTermsDays: 30 },
      customer: null,
      lines: [],
    });

    const quote = await sendQuote('quo_1');

    expect(quote.status).toBe('sent');
    expect(prismaMock.quote.update).toHaveBeenCalledWith({
      where: { id: 'quo_1' },
      data: { status: 'sent' },
      include: expect.any(Object),
    });
  });

  it('updateQuoteStatus validates status', () => {
    expect(() => parseUpdateQuoteStatusInput({ status: 'bogus' })).toThrow(
      /Invalid quote status/
    );
  });

  it('serializeQuote includes nested company and lines', () => {
    const serialized = serializeQuote({
      id: 'quo_1',
      quoteNumber: 'QUO-1',
      companyId: 'co_1',
      customerId: null,
      status: 'draft',
      currency: 'USD',
      subtotalCents: 500,
      totalCents: 500,
      notes: null,
      orderId: null,
      expiresAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      company: { id: 'co_1', name: 'Acme' },
      lines: [
        {
          id: 'line_1',
          variantId: 'var_1',
          quantity: 1,
          priceCents: 500,
          titleSnapshot: 'Widget',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    expect(serialized.company?.name).toBe('Acme');
    expect(serialized.lines).toHaveLength(1);
  });
});
