// app/core/marketing/index.server.js
// Marketing automation: segments, campaigns, abandoned-cart sequences.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { emit } from '#/core/events/index.server';
import { hasMarketingConsent } from '#/core/gdpr/index.server';

/**
 * @typedef {{ minOrders?: number, minSpentCents?: number, customerGroupId?: string }} SegmentRules
 */

export function parseSegmentRules(rulesJson) {
  try {
    return JSON.parse(rulesJson ?? '{}');
  } catch {
    return {};
  }
}

export async function listSegments() {
  return prisma.marketingSegment.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { campaigns: true } } },
  });
}

export async function createSegment({ name, rules }) {
  return prisma.marketingSegment.create({
    data: {
      name,
      rulesJson: JSON.stringify(rules ?? {}),
    },
  });
}

export async function updateSegment(id, { name, rules }) {
  return prisma.marketingSegment.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(rules !== undefined ? { rulesJson: JSON.stringify(rules) } : {}),
    },
  });
}

export async function deleteSegment(id) {
  return prisma.marketingSegment.delete({ where: { id } });
}

/**
 * Evaluate whether a customer matches segment rules.
 * @param {string} customerId
 * @param {SegmentRules} rules
 */
export async function customerMatchesSegment(customerId, rules) {
  if (!rules || Object.keys(rules).length === 0) return true;

  if (rules.customerGroupId) {
    const member = await prisma.customerGroupMember.findUnique({
      where: {
        customerGroupId_customerId: {
          customerGroupId: rules.customerGroupId,
          customerId,
        },
      },
    });
    if (!member) return false;
  }

  const orders = await prisma.order.findMany({
    where: { customerId, status: { notIn: ['cancelled'] } },
    select: { totalCents: true },
  });

  const orderCount = orders.length;
  const spentCents = orders.reduce((sum, o) => sum + o.totalCents, 0);

  if (rules.minOrders != null && orderCount < rules.minOrders) return false;
  if (rules.minSpentCents != null && spentCents < rules.minSpentCents) {
    return false;
  }

  return true;
}

export async function resolveSegmentCustomers(segmentId) {
  const segment = await prisma.marketingSegment.findUnique({
    where: { id: segmentId },
  });
  if (!segment) return [];

  const rules = parseSegmentRules(segment.rulesJson);
  const customers = await prisma.customer.findMany({
    where: { erasedAt: null },
    select: { id: true, email: true, name: true, consentJson: true },
  });

  const matched = [];
  for (const customer of customers) {
    if (!(await customerMatchesSegment(customer.id, rules))) continue;
    if (!hasMarketingConsent(customer.consentJson)) continue;
    matched.push(customer);
  }
  return matched;
}

export async function listCampaigns() {
  return prisma.marketingCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: { segment: true, _count: { select: { deliveries: true } } },
  });
}

export async function createCampaign({
  segmentId,
  name,
  subject,
  bodyHtml,
  scheduledAt,
}) {
  return prisma.marketingCampaign.create({
    data: {
      segmentId,
      name,
      subject,
      bodyHtml,
      scheduledAt: scheduledAt ?? null,
      status: scheduledAt ? 'scheduled' : 'draft',
    },
  });
}

export async function sendCampaign(campaignId) {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    include: { segment: true },
  });
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');
  if (campaign.status === 'sent') throw new Error('CAMPAIGN_ALREADY_SENT');

  const customers = await resolveSegmentCustomers(campaign.segmentId);
  let sent = 0;
  const { sendCampaignEmail } = await import('#/emails/index.server');

  for (const customer of customers) {
    const existing = await prisma.campaignDelivery.findUnique({
      where: {
        campaignId_customerId: {
          campaignId,
          customerId: customer.id,
        },
      },
    });
    if (existing?.status === 'sent') continue;

    try {
      await sendCampaignEmail({
        to: customer.email,
        subject: campaign.subject,
        bodyHtml: campaign.bodyHtml,
        name: customer.name ?? 'there',
      });

      await prisma.campaignDelivery.upsert({
        where: {
          campaignId_customerId: {
            campaignId,
            customerId: customer.id,
          },
        },
        create: {
          campaignId,
          customerId: customer.id,
          email: customer.email,
          status: 'sent',
          sentAt: new Date(),
        },
        update: {
          status: 'sent',
          sentAt: new Date(),
        },
      });
      sent += 1;
    } catch (err) {
      logger.error(
        { err, campaignId, customerId: customer.id },
        'Campaign delivery failed'
      );
      await prisma.campaignDelivery.upsert({
        where: {
          campaignId_customerId: {
            campaignId,
            customerId: customer.id,
          },
        },
        create: {
          campaignId,
          customerId: customer.id,
          email: customer.email,
          status: 'failed',
        },
        update: { status: 'failed' },
      });
    }
  }

  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { status: 'sent', sentAt: new Date() },
  });

  logger.info({ campaignId, sent }, 'Campaign sent');
  return { sent, total: customers.length };
}

export async function listAbandonedCartSequences() {
  return prisma.abandonedCartSequence.findMany({
    orderBy: { stepNumber: 'asc' },
  });
}

export async function createAbandonedCartSequence({
  name,
  stepNumber,
  delayMinutes,
  subject,
}) {
  return prisma.abandonedCartSequence.create({
    data: { name, stepNumber, delayMinutes, subject, active: true },
  });
}

export async function updateAbandonedCartSequence(id, data) {
  return prisma.abandonedCartSequence.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.stepNumber !== undefined ? { stepNumber: data.stepNumber } : {}),
      ...(data.delayMinutes !== undefined
        ? { delayMinutes: data.delayMinutes }
        : {}),
      ...(data.subject !== undefined ? { subject: data.subject } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });
}

/**
 * Process abandoned carts and enqueue sequence emails.
 */
export async function processAbandonedCarts() {
  const sequences = await prisma.abandonedCartSequence.findMany({
    where: { active: true },
    orderBy: { stepNumber: 'asc' },
  });
  if (!sequences.length) return { processed: 0 };

  const cutoff = new Date(Date.now() - sequences[0].delayMinutes * 60 * 1000);

  const carts = await prisma.cart.findMany({
    where: {
      lockedAt: null,
      updatedAt: { lt: cutoff },
      lines: { some: {} },
      checkouts: { none: { step: 'completed' } },
    },
    include: {
      lines: true,
      customer: { select: { email: true, name: true, consentJson: true } },
      checkouts: {
        where: { step: { not: 'completed' } },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
    take: 100,
  });

  let processed = 0;
  const { queueAbandonedCart } = await import('#/emails/job.server');

  for (const cart of carts) {
    const email = cart.customer?.email ?? cart.checkouts[0]?.email ?? null;
    if (!email) continue;

    if (!hasMarketingConsent(cart.customer?.consentJson)) continue;

    for (const sequence of sequences) {
      const sequenceCutoff = new Date(
        Date.now() - sequence.delayMinutes * 60 * 1000
      );
      if (cart.updatedAt > sequenceCutoff) continue;

      const alreadySent = await prisma.abandonedCartSend.findUnique({
        where: {
          cartId_sequenceId: { cartId: cart.id, sequenceId: sequence.id },
        },
      });
      if (alreadySent) continue;

      emit('cart.abandoned', {
        cartId: cart.id,
        token: cart.token,
        email,
        currency: cart.currency,
        lineCount: cart.lines.length,
        updatedAt: cart.updatedAt.toISOString(),
      });

      queueAbandonedCart({
        email,
        name: cart.customer?.name ?? 'there',
        subject: sequence.subject,
        cartUrl: `/cart`,
        lines: cart.lines.map((l) => ({
          title: l.titleSnapshot,
          quantity: l.quantity,
          priceCents: l.priceCentsSnapshot,
        })),
        currency: cart.currency,
      });

      await prisma.abandonedCartSend.create({
        data: {
          cartId: cart.id,
          sequenceId: sequence.id,
          email,
        },
      });
      processed += 1;
    }
  }

  return { processed };
}

/**
 * Seed default abandoned-cart sequence steps if none exist.
 */
export async function seedDefaultAbandonedCartSequences() {
  const count = await prisma.abandonedCartSequence.count();
  if (count > 0) return;

  await prisma.abandonedCartSequence.createMany({
    data: [
      {
        name: 'First reminder',
        stepNumber: 1,
        delayMinutes: 60,
        subject: 'You left items in your cart',
        active: true,
      },
      {
        name: 'Second reminder',
        stepNumber: 2,
        delayMinutes: 1440,
        subject: 'Still thinking it over?',
        active: true,
      },
    ],
  });
}
