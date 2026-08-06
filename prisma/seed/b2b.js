/**
 * B2B companies and quotes.
 */

import { listSeedCustomers } from './customers.js';
import { daysAgo } from './helpers.js';
import { CATALOG } from './ids.js';

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function seedB2b(prisma) {
  const customers = await listSeedCustomers(prisma);
  if (customers.length < 3) {
    console.warn('Need customers for B2B seed; skipping.');
    return;
  }

  const company = await prisma.company.upsert({
    where: { id: 'seed-company-acme' },
    create: {
      id: 'seed-company-acme',
      name: 'Acme Workplace Co.',
      taxId: 'US-98-7654321',
      netTermsDays: 30,
      active: true,
    },
    update: {
      name: 'Acme Workplace Co.',
      active: true,
      netTermsDays: 30,
    },
  });

  const company2 = await prisma.company.upsert({
    where: { id: 'seed-company-northwind' },
    create: {
      id: 'seed-company-northwind',
      name: 'Northwind Studios',
      taxId: 'US-12-3456789',
      netTermsDays: 45,
      active: true,
    },
    update: {
      name: 'Northwind Studios',
      active: true,
    },
  });

  const members = [
    {
      id: 'seed-cm-01',
      companyId: company.id,
      customer: customers[10] ?? customers[0],
      role: 'admin',
    },
    {
      id: 'seed-cm-02',
      companyId: company.id,
      customer: customers[11] ?? customers[1],
      role: 'buyer',
    },
    {
      id: 'seed-cm-03',
      companyId: company2.id,
      customer: customers[12] ?? customers[2],
      role: 'buyer',
    },
  ];

  for (const m of members) {
    await prisma.companyMember.upsert({
      where: {
        companyId_customerId: {
          companyId: m.companyId,
          customerId: m.customer.id,
        },
      },
      create: {
        id: m.id,
        companyId: m.companyId,
        customerId: m.customer.id,
        role: m.role,
      },
      update: { role: m.role },
    });
  }

  const quoteLines = CATALOG.slice(0, 3).map((item, i) => ({
    id: `seed-ql-01-${i + 1}`,
    variantId: item.variantId,
    quantity: 5 + i * 2,
    priceCents: Math.round(item.priceCents * 0.85),
    titleSnapshot: item.title,
  }));
  const subtotal = quoteLines.reduce(
    (sum, line) => sum + line.priceCents * line.quantity,
    0
  );

  await prisma.quoteLine.deleteMany({
    where: { quote: { id: 'seed-quote-01' } },
  });
  await prisma.quote.upsert({
    where: { quoteNumber: 'Q-DEMO-1001' },
    create: {
      id: 'seed-quote-01',
      quoteNumber: 'Q-DEMO-1001',
      companyId: company.id,
      customerId: members[0].customer.id,
      status: 'sent',
      currency: 'USD',
      subtotalCents: subtotal,
      totalCents: subtotal,
      expiresAt: daysAgo(-14),
      notes: 'Volume pricing for Q3 office refresh.',
      lines: { create: quoteLines },
    },
    update: {
      status: 'sent',
      subtotalCents: subtotal,
      totalCents: subtotal,
      notes: 'Volume pricing for Q3 office refresh.',
    },
  });

  // Re-create lines on update path
  const quote = await prisma.quote.findUniqueOrThrow({
    where: { quoteNumber: 'Q-DEMO-1001' },
  });
  await prisma.quoteLine.deleteMany({ where: { quoteId: quote.id } });
  await prisma.quoteLine.createMany({
    data: quoteLines.map((line) => ({ ...line, quoteId: quote.id })),
  });

  await prisma.quote.upsert({
    where: { quoteNumber: 'Q-DEMO-1002' },
    create: {
      id: 'seed-quote-02',
      quoteNumber: 'Q-DEMO-1002',
      companyId: company2.id,
      customerId: members[2].customer.id,
      status: 'draft',
      currency: 'USD',
      subtotalCents: CATALOG[0].priceCents * 10,
      totalCents: CATALOG[0].priceCents * 10,
      notes: 'Draft quote — pending approval.',
      lines: {
        create: [
          {
            id: 'seed-ql-02-1',
            variantId: CATALOG[0].variantId,
            quantity: 10,
            priceCents: CATALOG[0].priceCents,
            titleSnapshot: CATALOG[0].title,
          },
        ],
      },
    },
    update: {
      status: 'draft',
      notes: 'Draft quote — pending approval.',
    },
  });

  console.log('Seeded B2B companies and quotes.');
}
