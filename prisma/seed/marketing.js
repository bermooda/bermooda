/**
 * Marketing segments, campaigns, abandoned-cart sequences.
 */

import { listSeedCustomers } from './customers.js';
import { daysAgo } from './helpers.js';
import { VARIANT_IDS } from './ids.js';

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function seedMarketing(prisma) {
  const customers = await listSeedCustomers(prisma);

  const segment = await prisma.marketingSegment.upsert({
    where: { id: 'seed-segment-engaged' },
    create: {
      id: 'seed-segment-engaged',
      name: 'Engaged shoppers',
      rulesJson: JSON.stringify({
        minOrders: 1,
        locales: ['en'],
      }),
    },
    update: {
      name: 'Engaged shoppers',
      rulesJson: JSON.stringify({
        minOrders: 1,
        locales: ['en'],
      }),
    },
  });

  const vipSegment = await prisma.marketingSegment.upsert({
    where: { id: 'seed-segment-vip' },
    create: {
      id: 'seed-segment-vip',
      name: 'VIP customers',
      rulesJson: JSON.stringify({ customerGroup: 'vip' }),
    },
    update: { name: 'VIP customers' },
  });

  const campaign = await prisma.marketingCampaign.upsert({
    where: { id: 'seed-campaign-spring' },
    create: {
      id: 'seed-campaign-spring',
      segmentId: segment.id,
      name: 'Spring refresh',
      subject: 'New arrivals for your space',
      bodyHtml:
        '<p>Discover this season’s favorites — speakers, textiles, and outdoor gear.</p>',
      status: 'sent',
      sentAt: daysAgo(5),
    },
    update: {
      name: 'Spring refresh',
      status: 'sent',
      sentAt: daysAgo(5),
    },
  });

  await prisma.marketingCampaign.upsert({
    where: { id: 'seed-campaign-draft' },
    create: {
      id: 'seed-campaign-draft',
      segmentId: vipSegment.id,
      name: 'VIP early access (draft)',
      subject: 'You’re invited: early access weekend',
      bodyHtml: '<p>VIP members shop the sale 24 hours early.</p>',
      status: 'draft',
    },
    update: {
      name: 'VIP early access (draft)',
      status: 'draft',
    },
  });

  for (let i = 0; i < Math.min(6, customers.length); i++) {
    const customer = customers[i];
    await prisma.campaignDelivery.upsert({
      where: {
        campaignId_customerId: {
          campaignId: campaign.id,
          customerId: customer.id,
        },
      },
      create: {
        id: `seed-delivery-${String(i + 1).padStart(2, '0')}`,
        campaignId: campaign.id,
        customerId: customer.id,
        email: customer.email,
        status: i % 5 === 0 ? 'failed' : 'sent',
        sentAt: daysAgo(5),
      },
      update: {
        email: customer.email,
        status: i % 5 === 0 ? 'failed' : 'sent',
      },
    });
  }

  // Abandoned cart sequences
  const sequences = [
    {
      id: 'seed-acs-1',
      name: 'Reminder 1',
      stepNumber: 1,
      delayMinutes: 60,
      subject: 'You left something behind',
    },
    {
      id: 'seed-acs-2',
      name: 'Reminder 2',
      stepNumber: 2,
      delayMinutes: 1440,
      subject: 'Still thinking it over?',
    },
    {
      id: 'seed-acs-3',
      name: 'Last chance',
      stepNumber: 3,
      delayMinutes: 4320,
      subject: 'Your cart expires soon',
    },
  ];
  for (const seq of sequences) {
    await prisma.abandonedCartSequence.upsert({
      where: { stepNumber: seq.stepNumber },
      create: { ...seq, active: true },
      update: {
        name: seq.name,
        delayMinutes: seq.delayMinutes,
        subject: seq.subject,
        active: true,
      },
    });
  }

  // Open carts + abandoned sends for a couple customers
  if (customers[0]) {
    const cart = await prisma.cart.upsert({
      where: { id: 'seed-cart-abandoned-01' },
      create: {
        id: 'seed-cart-abandoned-01',
        token: 'seed-cart-token-abandoned-01',
        customerId: customers[0].id,
        currency: 'USD',
      },
      update: {
        customerId: customers[0].id,
      },
    });

    await prisma.cartLine.deleteMany({ where: { cartId: cart.id } });
    await prisma.cartLine.create({
      data: {
        id: 'seed-cartline-01',
        cartId: cart.id,
        variantId: VARIANT_IDS.yogaMat,
        quantity: 1,
        priceCentsSnapshot: 8900,
        titleSnapshot: 'Cork-top yoga mat',
      },
    });

    const seq1 = await prisma.abandonedCartSequence.findUniqueOrThrow({
      where: { stepNumber: 1 },
    });
    await prisma.abandonedCartSend.upsert({
      where: {
        cartId_sequenceId: {
          cartId: cart.id,
          sequenceId: seq1.id,
        },
      },
      create: {
        id: 'seed-acs-send-01',
        cartId: cart.id,
        sequenceId: seq1.id,
        email: customers[0].email,
        sentAt: daysAgo(1),
      },
      update: { email: customers[0].email },
    });
  }

  console.log(
    'Seeded marketing segments, campaigns, and abandoned-cart flows.'
  );
}
