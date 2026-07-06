// app/core/marketing/index.server.js
// Marketing automation: segments, campaigns, abandoned-cart sequences.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { emit } from '#/core/events/index.server';
import { hasMarketingConsent } from '#/core/gdpr/index.server';
import { sendCampaignEmail } from '#/emails/index.server';
import { queueAbandonedCart } from '#/emails/job.server';

const MAX_LIST_RESULTS = 100;

const SEGMENT_LIST_INCLUDE = {
  _count: { select: { campaigns: true } },
};

const CAMPAIGN_LIST_INCLUDE = {
  segment: true,
  _count: { select: { deliveries: true } },
};

export const DEFAULT_ABANDONED_CART_SEQUENCES = [
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
];

/**
 * @typedef {{ minOrders?: number, minSpentCents?: number, customerGroupId?: string }} SegmentRules
 */

// ---------------------------------------------------------------------------
// Segment rules parsing
// ---------------------------------------------------------------------------

/**
 * Parse segment rules from stored JSON.
 *
 * @param {string|null|undefined} rulesJson
 * @returns {SegmentRules}
 */
export function parseSegmentRules(rulesJson) {
  try {
    const parsed = JSON.parse(rulesJson ?? '{}');
    return parseSegmentRulesInput(parsed);
  } catch {
    return {};
  }
}

/**
 * Parse segment rules from admin/API input.
 *
 * @param {object} input
 * @returns {SegmentRules}
 */
export function parseSegmentRulesInput(input = {}) {
  const rules = {};

  if (input.minOrders != null && input.minOrders !== '') {
    const minOrders = parseInt(String(input.minOrders), 10);
    if (Number.isFinite(minOrders) && minOrders >= 0) {
      rules.minOrders = minOrders;
    }
  }

  if (input.minSpentCents != null && input.minSpentCents !== '') {
    const minSpentCents = parseInt(String(input.minSpentCents), 10);
    if (Number.isFinite(minSpentCents) && minSpentCents >= 0) {
      rules.minSpentCents = minSpentCents;
    }
  }

  const customerGroupId = input.customerGroupId?.toString().trim();
  if (customerGroupId) {
    rules.customerGroupId = customerGroupId;
  }

  return rules;
}

/**
 * Parse segment rules from an admin form submission.
 *
 * @param {FormData} formData
 * @returns {SegmentRules}
 */
export function parseSegmentRulesFromForm(formData) {
  return parseSegmentRulesInput({
    minOrders: formData.get('minOrders'),
    minSpentCents: formData.get('minSpentCents'),
    customerGroupId: formData.get('customerGroupId'),
  });
}

/**
 * Parse admin/API create payload for a marketing segment.
 *
 * @param {object} input
 */
export function parseCreateSegmentInput(input = {}) {
  const name = input.name?.toString().trim();
  if (!name) {
    throw Object.assign(new Error('Segment name is required.'), {
      code: 'NAME_REQUIRED',
    });
  }

  const rules =
    input.rules !== undefined
      ? parseSegmentRulesInput(input.rules)
      : parseSegmentRulesInput(input);

  return { name, rules };
}

/**
 * Parse admin/API update payload for a marketing segment.
 *
 * @param {object} input
 */
export function parseUpdateSegmentInput(input = {}) {
  const parsed = {};

  if (input.name !== undefined) {
    const name = input.name?.toString().trim();
    if (!name) {
      throw Object.assign(new Error('Segment name is required.'), {
        code: 'NAME_REQUIRED',
      });
    }
    parsed.name = name;
  }

  if (input.rules !== undefined) {
    parsed.rules = parseSegmentRulesInput(input.rules);
  } else if (
    input.minOrders !== undefined ||
    input.minSpentCents !== undefined ||
    input.customerGroupId !== undefined
  ) {
    parsed.rules = parseSegmentRulesInput(input);
  }

  return parsed;
}

/**
 * Parse admin/API create payload for a marketing campaign.
 *
 * @param {object} input
 */
export function parseCreateCampaignInput(input = {}) {
  const segmentId = input.segmentId?.toString().trim();
  const name = input.name?.toString().trim();
  const subject = input.subject?.toString().trim();
  const bodyHtml = input.bodyHtml?.toString().trim();

  if (!segmentId || !name || !subject || !bodyHtml) {
    throw Object.assign(new Error('All campaign fields are required.'), {
      code: 'CAMPAIGN_INVALID',
    });
  }

  let scheduledAt = null;
  if (input.scheduledAt) {
    const parsed =
      input.scheduledAt instanceof Date
        ? input.scheduledAt
        : new Date(input.scheduledAt);
    if (!Number.isNaN(parsed.getTime())) {
      scheduledAt = parsed;
    }
  }

  return { segmentId, name, subject, bodyHtml, scheduledAt };
}

/**
 * Parse admin/API create payload for an abandoned-cart sequence step.
 *
 * @param {object} input
 */
export function parseCreateAbandonedCartSequenceInput(input = {}) {
  const name = input.name?.toString().trim();
  const subject = input.subject?.toString().trim();
  const stepNumber = parseInt(String(input.stepNumber ?? '1'), 10);
  const delayMinutes = parseInt(String(input.delayMinutes ?? '60'), 10);

  if (!name || !subject) {
    throw Object.assign(new Error('Sequence name and subject are required.'), {
      code: 'SEQUENCE_INVALID',
    });
  }

  if (!Number.isFinite(stepNumber) || stepNumber < 1) {
    throw Object.assign(new Error('Step number must be at least 1.'), {
      code: 'SEQUENCE_INVALID',
    });
  }

  if (!Number.isFinite(delayMinutes) || delayMinutes < 1) {
    throw Object.assign(new Error('Delay must be at least 1 minute.'), {
      code: 'SEQUENCE_INVALID',
    });
  }

  return { name, subject, stepNumber, delayMinutes };
}

/**
 * Parse admin/API update payload for an abandoned-cart sequence step.
 *
 * @param {object} input
 */
export function parseUpdateAbandonedCartSequenceInput(input = {}) {
  const parsed = {};

  if (input.name !== undefined) {
    const name = input.name?.toString().trim();
    if (!name) {
      throw Object.assign(new Error('Sequence name is required.'), {
        code: 'SEQUENCE_INVALID',
      });
    }
    parsed.name = name;
  }

  if (input.subject !== undefined) {
    const subject = input.subject?.toString().trim();
    if (!subject) {
      throw Object.assign(new Error('Sequence subject is required.'), {
        code: 'SEQUENCE_INVALID',
      });
    }
    parsed.subject = subject;
  }

  if (input.stepNumber !== undefined) {
    const stepNumber = parseInt(String(input.stepNumber), 10);
    if (!Number.isFinite(stepNumber) || stepNumber < 1) {
      throw Object.assign(new Error('Step number must be at least 1.'), {
        code: 'SEQUENCE_INVALID',
      });
    }
    parsed.stepNumber = stepNumber;
  }

  if (input.delayMinutes !== undefined) {
    const delayMinutes = parseInt(String(input.delayMinutes), 10);
    if (!Number.isFinite(delayMinutes) || delayMinutes < 1) {
      throw Object.assign(new Error('Delay must be at least 1 minute.'), {
        code: 'SEQUENCE_INVALID',
      });
    }
    parsed.delayMinutes = delayMinutes;
  }

  if (input.active !== undefined) {
    parsed.active =
      input.active === true || input.active === 'on' || input.active === 'true';
  }

  return parsed;
}

function serializeSegment(segment) {
  return {
    ...segment,
    rules: parseSegmentRules(segment.rulesJson),
  };
}

function serializeCampaign(campaign) {
  return {
    ...campaign,
    segment: campaign.segment
      ? serializeSegment(campaign.segment)
      : campaign.segment,
  };
}

function notFound(entity) {
  throw Object.assign(new Error(`${entity} not found`), {
    code: 'NOT_FOUND',
    status: 404,
  });
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

/**
 * List marketing segments with pagination.
 *
 * @param {{ page?: number, limit?: number }} [opts]
 */
export async function listSegments({ page = 1, limit = 50 } = {}) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), MAX_LIST_RESULTS);
  const skip = (safePage - 1) * safeLimit;

  const [segments, total] = await Promise.all([
    prisma.marketingSegment.findMany({
      orderBy: { name: 'asc' },
      include: SEGMENT_LIST_INCLUDE,
      skip,
      take: safeLimit,
    }),
    prisma.marketingSegment.count(),
  ]);

  return {
    segments: segments.map(serializeSegment),
    total,
    page: safePage,
    limit: safeLimit,
  };
}

/**
 * Get a marketing segment by id.
 *
 * @param {string} id
 */
export async function getSegment(id) {
  const segment = await prisma.marketingSegment.findUnique({
    where: { id },
    include: SEGMENT_LIST_INCLUDE,
  });
  if (!segment) notFound('Segment');
  return serializeSegment(segment);
}

export async function createSegment(input) {
  const { name, rules } = parseCreateSegmentInput(input);

  const segment = await prisma.marketingSegment.create({
    data: {
      name,
      rulesJson: JSON.stringify(rules),
    },
    include: SEGMENT_LIST_INCLUDE,
  });

  return serializeSegment(segment);
}

export async function updateSegment(id, input) {
  await getSegment(id);
  const parsed = parseUpdateSegmentInput(input);

  if (Object.keys(parsed).length === 0) {
    throw Object.assign(new Error('No valid fields to update'), {
      code: 'NO_CHANGES',
    });
  }

  const data = { ...parsed };
  if (parsed.rules) {
    data.rulesJson = JSON.stringify(parsed.rules);
    delete data.rules;
  }

  const segment = await prisma.marketingSegment.update({
    where: { id },
    data,
    include: SEGMENT_LIST_INCLUDE,
  });

  return serializeSegment(segment);
}

export async function deleteSegment(id) {
  await getSegment(id);
  await prisma.marketingSegment.delete({ where: { id } });
}

/**
 * Evaluate whether a customer matches segment rules.
 *
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
  const segment = await getSegment(segmentId);
  const rules = segment.rules;

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

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

/**
 * List marketing campaigns with pagination.
 *
 * @param {{ page?: number, limit?: number }} [opts]
 */
export async function listCampaigns({ page = 1, limit = 50 } = {}) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), MAX_LIST_RESULTS);
  const skip = (safePage - 1) * safeLimit;

  const [campaigns, total] = await Promise.all([
    prisma.marketingCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: CAMPAIGN_LIST_INCLUDE,
      skip,
      take: safeLimit,
    }),
    prisma.marketingCampaign.count(),
  ]);

  return {
    campaigns: campaigns.map(serializeCampaign),
    total,
    page: safePage,
    limit: safeLimit,
  };
}

/**
 * Get a marketing campaign by id.
 *
 * @param {string} id
 */
export async function getCampaign(id) {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id },
    include: CAMPAIGN_LIST_INCLUDE,
  });
  if (!campaign) notFound('Campaign');
  return serializeCampaign(campaign);
}

export async function createCampaign(input) {
  const { segmentId, name, subject, bodyHtml, scheduledAt } =
    parseCreateCampaignInput(input);

  await getSegment(segmentId);

  const campaign = await prisma.marketingCampaign.create({
    data: {
      segmentId,
      name,
      subject,
      bodyHtml,
      scheduledAt: scheduledAt ?? null,
      status: scheduledAt ? 'scheduled' : 'draft',
    },
    include: CAMPAIGN_LIST_INCLUDE,
  });

  return serializeCampaign(campaign);
}

export async function sendCampaign(campaignId) {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    include: { segment: true },
  });
  if (!campaign) notFound('Campaign');
  if (campaign.status === 'sent') {
    throw Object.assign(new Error('Campaign already sent'), {
      code: 'CAMPAIGN_ALREADY_SENT',
    });
  }

  const customers = await resolveSegmentCustomers(campaign.segmentId);
  let sent = 0;

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

// ---------------------------------------------------------------------------
// Abandoned cart sequences
// ---------------------------------------------------------------------------

/**
 * List abandoned-cart sequence steps with pagination.
 *
 * @param {{ page?: number, limit?: number }} [opts]
 */
export async function listAbandonedCartSequences({
  page = 1,
  limit = 50,
} = {}) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), MAX_LIST_RESULTS);
  const skip = (safePage - 1) * safeLimit;

  const [sequences, total] = await Promise.all([
    prisma.abandonedCartSequence.findMany({
      orderBy: { stepNumber: 'asc' },
      skip,
      take: safeLimit,
    }),
    prisma.abandonedCartSequence.count(),
  ]);

  return {
    sequences,
    total,
    page: safePage,
    limit: safeLimit,
  };
}

/**
 * Get an abandoned-cart sequence step by id.
 *
 * @param {string} id
 */
export async function getAbandonedCartSequence(id) {
  const sequence = await prisma.abandonedCartSequence.findUnique({
    where: { id },
  });
  if (!sequence) notFound('Abandoned cart sequence');
  return sequence;
}

export async function createAbandonedCartSequence(input) {
  const { name, stepNumber, delayMinutes, subject } =
    parseCreateAbandonedCartSequenceInput(input);

  return prisma.abandonedCartSequence.create({
    data: { name, stepNumber, delayMinutes, subject, active: true },
  });
}

export async function updateAbandonedCartSequence(id, input) {
  await getAbandonedCartSequence(id);
  const parsed = parseUpdateAbandonedCartSequenceInput(input);

  if (Object.keys(parsed).length === 0) {
    throw Object.assign(new Error('No valid fields to update'), {
      code: 'NO_CHANGES',
    });
  }

  return prisma.abandonedCartSequence.update({
    where: { id },
    data: parsed,
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
    data: DEFAULT_ABANDONED_CART_SEQUENCES,
  });
}
