// app/core/b2b/index.server.js
// B2B company accounts and quote workflow foundation.

import prisma from '#/libs/prisma.server';

function nextQuoteNumber() {
  return `QUO-${Date.now()}`;
}

export async function listCompanies() {
  return prisma.company.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { members: true, quotes: true } },
    },
  });
}

export async function getCompany(id) {
  return prisma.company.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          customer: { select: { id: true, email: true, name: true } },
        },
      },
      quotes: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
}

export async function createCompany({ name, taxId, netTermsDays = 30 }) {
  return prisma.company.create({
    data: {
      name,
      taxId: taxId ?? null,
      netTermsDays,
      active: true,
    },
  });
}

export async function addCompanyMember(companyId, customerId, role = 'buyer') {
  return prisma.companyMember.create({
    data: { companyId, customerId, role },
  });
}

export async function listQuotes({ companyId, status } = {}) {
  return prisma.quote.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      company: { select: { id: true, name: true } },
      customer: { select: { id: true, email: true, name: true } },
      _count: { select: { lines: true } },
    },
  });
}

export async function getQuote(id) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      company: true,
      customer: { select: { id: true, email: true, name: true } },
      lines: {
        include: {
          variant: {
            include: { product: true, prices: true },
          },
        },
      },
    },
  });
}

export async function createQuote({
  companyId,
  customerId,
  currency = 'USD',
  notes,
  expiresAt,
  lines = [],
}) {
  let subtotalCents = 0;

  const quote = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        quoteNumber: nextQuoteNumber(),
        companyId,
        customerId: customerId ?? null,
        currency,
        notes: notes ?? null,
        expiresAt: expiresAt ?? null,
        status: 'draft',
      },
    });

    for (const line of lines) {
      const lineTotal = line.priceCents * line.quantity;
      subtotalCents += lineTotal;

      await tx.quoteLine.create({
        data: {
          quoteId: created.id,
          variantId: line.variantId,
          quantity: line.quantity,
          priceCents: line.priceCents,
          titleSnapshot: line.titleSnapshot ?? null,
        },
      });
    }

    return tx.quote.update({
      where: { id: created.id },
      data: { subtotalCents, totalCents: subtotalCents },
    });
  });

  return getQuote(quote.id);
}

export async function updateQuoteStatus(id, status) {
  return prisma.quote.update({
    where: { id },
    data: { status },
  });
}

export async function sendQuote(id) {
  return updateQuoteStatus(id, 'sent');
}

export async function acceptQuote(id, orderId) {
  return prisma.quote.update({
    where: { id },
    data: { status: 'accepted', orderId },
  });
}
