// app/core/marketing/segments.server.js
// Marketing segment parsers, CRUD, and customer matching.

import prisma from '#/libs/prisma.server';
import { buildPrismaPagination } from '#/libs/prisma/pagination/index.server';
import { hasMarketingConsent } from '#/core/gdpr/index.server';
import { notFound } from '#/core/marketing/shared.server';

const SEGMENT_LIST_INCLUDE = {
  _count: { select: { campaigns: true } },
};

/**
 * @typedef {{ minOrders?: number, minSpentCents?: number, customerGroupId?: string }} SegmentRules
 */

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
 * Serialize a segment row, parsing rulesJson into rules.
 *
 * @param {object} segment
 * @returns {object}
 */
export function serializeSegment(segment) {
  return {
    ...segment,
    rules: parseSegmentRules(segment.rulesJson),
  };
}

/**
 * List marketing segments with pagination.
 *
 * @param {{ page?: number, limit?: number }} [opts]
 */
export async function listSegments({ page = 1, limit = 50 } = {}) {
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

  const [segments, total] = await Promise.all([
    prisma.marketingSegment.findMany({
      orderBy: { name: 'asc' },
      include: SEGMENT_LIST_INCLUDE,
      skip,
      take,
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
