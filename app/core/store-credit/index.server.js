// app/core/store-credit/index.server.js
// Store-credit ledger — reusable by returns (W4) and checkout tenders.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

/**
 * Parse admin/API issue payload into normalized store credit fields.
 *
 * @param {object} input
 * @returns {{ amountCents: number, reason: string|null, referenceType: string|null, referenceId: string|null }}
 */
export function parseIssueStoreCreditInput(input = {}) {
  const amountCents =
    typeof input.amountCents === 'number'
      ? input.amountCents
      : parseInt(String(input.amountCents ?? '0'), 10);

  const reason = input.reason?.toString().trim() || null;
  const referenceType = input.referenceType?.toString().trim() || null;
  const referenceId = input.referenceId?.toString().trim() || null;

  return { amountCents, reason, referenceType, referenceId };
}

// ---------------------------------------------------------------------------
// Balance + ledger
// ---------------------------------------------------------------------------

/**
 * @param {import('@prisma/client').Prisma.TransactionClient | typeof prisma} client
 * @param {string} customerId
 * @returns {Promise<number>}
 */
async function resolveCurrentBalance(client, customerId) {
  const latest = await client.storeCreditLedger.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfterCents: true },
  });
  return latest?.balanceAfterCents ?? 0;
}

/**
 * Get the current store-credit balance for a customer (latest ledger entry).
 * @param {string} customerId
 * @returns {Promise<number>} balance in cents
 */
export async function getStoreCreditBalance(customerId) {
  return resolveCurrentBalance(prisma, customerId);
}

/**
 * Load a customer's store-credit balance for checkout and admin views.
 *
 * @param {string} [customerId]
 * @returns {Promise<{ balance: number }>}
 */
export async function getCustomerStoreCreditSummary(customerId) {
  if (!customerId) {
    return { balance: 0 };
  }

  const balance = await getStoreCreditBalance(customerId);
  return { balance };
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient | typeof prisma} client
 * @param {string} customerId
 * @param {{ amountCents: number, reason?: string, referenceType?: string, referenceId?: string }} params
 */
async function appendLedgerEntry(
  client,
  customerId,
  { amountCents, reason, referenceType, referenceId }
) {
  const balanceAfterCents =
    (await resolveCurrentBalance(client, customerId)) + amountCents;

  return client.storeCreditLedger.create({
    data: {
      customerId,
      amountCents,
      balanceAfterCents,
      reason: reason ?? null,
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
    },
  });
}

/**
 * List ledger entries for a customer, newest first.
 *
 * @param {string} customerId
 * @param {{ page?: number, limit?: number }} [options]
 * @returns {Promise<{ entries: object[], total: number }>}
 */
export async function listLedgerEntries(
  customerId,
  { page = 1, limit = 50 } = {}
) {
  const skip = (page - 1) * limit;
  const where = { customerId };

  const [entries, total] = await Promise.all([
    prisma.storeCreditLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.storeCreditLedger.count({ where }),
  ]);

  return { entries, total };
}

/**
 * Issue store credit to a customer (positive ledger entry).
 *
 * @param {string} customerId
 * @param {{ amountCents: number, reason?: string, referenceType?: string, referenceId?: string }} params
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 * @returns {Promise<object>} created ledger entry
 */
export async function issueStoreCredit(
  customerId,
  { amountCents, reason, referenceType, referenceId },
  tx
) {
  if (!amountCents || amountCents <= 0) {
    throw new Error('INVALID_CREDIT_AMOUNT');
  }

  const client = tx ?? prisma;
  const entry = await appendLedgerEntry(client, customerId, {
    amountCents,
    reason,
    referenceType,
    referenceId,
  });

  logger.info(
    { customerId, amountCents, balanceAfterCents: entry.balanceAfterCents },
    'Store credit issued'
  );

  return entry;
}

/**
 * Redeem store credit (negative ledger entry).
 *
 * @param {string} customerId
 * @param {{ amountCents: number, reason?: string, referenceType?: string, referenceId?: string }} params
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 * @returns {Promise<object>} created ledger entry
 */
export async function redeemStoreCredit(
  customerId,
  { amountCents, reason, referenceType, referenceId },
  tx
) {
  if (!amountCents || amountCents <= 0) {
    throw new Error('INVALID_DEBIT_AMOUNT');
  }

  const client = tx ?? prisma;
  const currentBalance = await resolveCurrentBalance(client, customerId);

  if (currentBalance < amountCents) {
    throw new Error('INSUFFICIENT_STORE_CREDIT');
  }

  const entry = await appendLedgerEntry(client, customerId, {
    amountCents: -amountCents,
    reason,
    referenceType,
    referenceId,
  });

  logger.info(
    { customerId, amountCents, balanceAfterCents: entry.balanceAfterCents },
    'Store credit redeemed'
  );

  return entry;
}

// ---------------------------------------------------------------------------
// Checkout redemption
// ---------------------------------------------------------------------------

/**
 * Resolve store-credit discount cents from requested amount.
 *
 * @param {string} customerId
 * @param {number} requestedCents
 * @param {number} remainingCents
 * @returns {Promise<{ storeCreditCents: number }>}
 */
export async function resolveStoreCreditRedemption(
  customerId,
  requestedCents,
  remainingCents
) {
  if (!customerId || requestedCents <= 0 || remainingCents <= 0) {
    return { storeCreditCents: 0 };
  }

  const balance = await getStoreCreditBalance(customerId);
  const storeCreditCents = Math.min(
    balance,
    requestedCents,
    Math.max(0, remainingCents)
  );

  return { storeCreditCents };
}
