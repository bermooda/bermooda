// app/core/store-credit/index.server.js
// Store-credit ledger — reusable by returns (W4) and gift cards (W7).

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

/**
 * Get the current store-credit balance for a customer (latest ledger entry).
 * @param {string} customerId
 * @returns {Promise<number>} balance in cents
 */
export async function getStoreCreditBalance(customerId) {
  const latest = await prisma.storeCreditLedger.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfterCents: true },
  });
  return latest?.balanceAfterCents ?? 0;
}

/**
 * List ledger entries for a customer, newest first.
 * @param {string} customerId
 * @param {{ page?: number, limit?: number }} options
 * @returns {Promise<object[]>}
 */
export async function listLedgerEntries(
  customerId,
  { page = 1, limit = 50 } = {}
) {
  const skip = (page - 1) * limit;
  return prisma.storeCreditLedger.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
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

  const currentBalance = tx
    ? await getBalanceInTransaction(client, customerId)
    : await getStoreCreditBalance(customerId);

  const balanceAfterCents = currentBalance + amountCents;

  const entry = await client.storeCreditLedger.create({
    data: {
      customerId,
      amountCents,
      balanceAfterCents,
      reason: reason ?? null,
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
    },
  });

  logger.info(
    { customerId, amountCents, balanceAfterCents },
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

  const currentBalance = tx
    ? await getBalanceInTransaction(client, customerId)
    : await getStoreCreditBalance(customerId);

  if (currentBalance < amountCents) {
    throw new Error('INSUFFICIENT_STORE_CREDIT');
  }

  const balanceAfterCents = currentBalance - amountCents;

  const entry = await client.storeCreditLedger.create({
    data: {
      customerId,
      amountCents: -amountCents,
      balanceAfterCents,
      reason: reason ?? null,
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
    },
  });

  logger.info(
    { customerId, amountCents, balanceAfterCents },
    'Store credit redeemed'
  );

  return entry;
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} customerId
 * @returns {Promise<number>}
 */
async function getBalanceInTransaction(tx, customerId) {
  const latest = await tx.storeCreditLedger.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfterCents: true },
  });
  return latest?.balanceAfterCents ?? 0;
}
