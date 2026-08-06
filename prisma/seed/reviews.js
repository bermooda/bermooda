/**
 * Product reviews.
 */

import { listSeedCustomers } from './customers.js';
import { daysAgo } from './helpers.js';
import { CATALOG } from './ids.js';

const REVIEW_COPY = [
  {
    rating: 5,
    title: 'Exceeded expectations',
    body: 'Build quality is excellent and shipping was fast. Would buy again.',
    status: 'approved',
  },
  {
    rating: 4,
    title: 'Solid everyday pick',
    body: 'Does what it claims. Packaging was thoughtful and eco-friendly.',
    status: 'approved',
  },
  {
    rating: 5,
    title: 'Gift favorite',
    body: 'Bought this as a gift and got rave reviews from the recipient.',
    status: 'approved',
  },
  {
    rating: 3,
    title: 'Almost perfect',
    body: 'Great product overall, though instructions could be clearer.',
    status: 'pending',
  },
  {
    rating: 2,
    title: 'Not quite right',
    body: 'Color differed slightly from photos. Returning for a different size.',
    status: 'rejected',
  },
  {
    rating: 5,
    title: 'Daily driver',
    body: 'I use this every morning. Feels durable and well made.',
    status: 'approved',
  },
  {
    rating: 4,
    title: 'Worth the price',
    body: 'A bit pricey but the materials justify it. Happy customer.',
    status: 'approved',
  },
  {
    rating: 5,
    title: 'Surprisingly good',
    body: 'Did not expect this much quality at this price point.',
    status: 'pending',
  },
];

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function seedReviews(prisma) {
  const customers = await listSeedCustomers(prisma);
  if (customers.length === 0) {
    console.warn('No customers; skipping reviews.');
    return;
  }

  let count = 0;
  for (let i = 0; i < REVIEW_COPY.length; i++) {
    const copy = REVIEW_COPY[i];
    const customer = customers[i % customers.length];
    const product = CATALOG[i % CATALOG.length];
    const id = `seed-review-${String(i + 1).padStart(2, '0')}`;

    // Unique on productId+customerId — skip if another review already links them
    const existing = await prisma.review.findUnique({
      where: {
        productId_customerId: {
          productId: product.productId,
          customerId: customer.id,
        },
      },
    });
    if (existing && existing.id !== id) {
      continue;
    }

    await prisma.review.upsert({
      where: { id },
      create: {
        id,
        productId: product.productId,
        customerId: customer.id,
        rating: copy.rating,
        title: copy.title,
        body: copy.body,
        status: copy.status,
        verifiedPurchase: i % 2 === 0,
        createdAt: daysAgo(20 - i),
      },
      update: {
        rating: copy.rating,
        title: copy.title,
        body: copy.body,
        status: copy.status,
        verifiedPurchase: i % 2 === 0,
      },
    });
    count += 1;
  }

  console.log(`Seeded ${count} product reviews.`);
}
