// app/core/marketing/campaigns.server.js
// Marketing campaign parsers, CRUD, and send.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { buildPrismaPagination } from '#/libs/prisma/pagination/index.server';
import {
  getSegment,
  resolveSegmentCustomers,
  serializeSegment,
} from '#/core/marketing/segments.server';
import { notFound } from '#/core/marketing/shared.server';
import { sendCampaignEmail } from '#/emails/index.server';

const CAMPAIGN_LIST_INCLUDE = {
  segment: true,
  _count: { select: { deliveries: true } },
};

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

function serializeCampaign(campaign) {
  return {
    ...campaign,
    segment: campaign.segment
      ? serializeSegment(campaign.segment)
      : campaign.segment,
  };
}

/**
 * List marketing campaigns with pagination.
 *
 * @param {{ page?: number, limit?: number }} [opts]
 */
export async function listCampaigns({ page = 1, limit = 50 } = {}) {
  const {
    page: safePage,
    limit: safeLimit,
    skip,
    take,
  } = buildPrismaPagination({
    page,
    limit,
    defaultLimit: 50,
  });

  const [campaigns, total] = await Promise.all([
    prisma.marketingCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: CAMPAIGN_LIST_INCLUDE,
      skip,
      take,
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
