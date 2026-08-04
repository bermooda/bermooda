// app/core/marketing/abandoned-cart.server.js
// Abandoned-cart sequence parsers, CRUD, processing, and seed defaults.

import prisma from '#/libs/prisma.server';
import { buildPrismaPagination } from '#/libs/prisma/pagination/index.server';
import { queueEmit } from '#/core/events/job.server';
import { hasMarketingConsent } from '#/core/gdpr/index.server';
import { queueAbandonedCart } from '#/emails/job.server';
import { notFound } from '#/core/marketing/shared.server';

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

/**
 * List abandoned-cart sequence steps with pagination.
 *
 * @param {{ page?: number, limit?: number }} [opts]
 */
export async function listAbandonedCartSequences({
  page = 1,
  limit = 50,
} = {}) {
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

  const [sequences, total] = await Promise.all([
    prisma.abandonedCartSequence.findMany({
      orderBy: { stepNumber: 'asc' },
      skip,
      take,
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

      queueEmit('cart.abandoned', {
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
