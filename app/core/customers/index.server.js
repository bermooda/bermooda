// app/core/customers/index.server.js
// Customer service: profile, address book, and order history.
// Auth is handled by better-auth (app/libs/auth/customer.server.js).
// This service is data-only — no auth imports.

import { containsFilter } from '#/utils/prisma-filters.server';
import prisma from '#/libs/prisma.server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CUSTOMER_PROFILE_FIELDS = ['name', 'phone', 'preferredLocale'];

const CUSTOMER_ORDER_LIST_INCLUDE = { lines: true };

const CUSTOMER_ORDER_DETAIL_INCLUDE = {
  lines: true,
  shipments: { include: { lines: true } },
  returns: { include: { lines: true } },
};

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

/**
 * Unset default flags on a customer's addresses, optionally keeping one id.
 *
 * @param {object} tx
 * @param {string} customerId
 * @param {string} [exceptAddressId]
 */
async function clearDefaultAddresses(tx, customerId, exceptAddressId) {
  const where = { customerId, isDefault: true };
  if (exceptAddressId) {
    where.id = { not: exceptAddressId };
  }

  await tx.address.updateMany({
    where,
    data: { isDefault: false },
  });
}

/**
 * Build a Prisma where clause for customer list search.
 *
 * @param {string} [q]
 * @returns {object}
 */
export function buildCustomerSearchWhere(q) {
  const query = q?.trim();
  if (!query) return {};

  return {
    OR: [{ email: containsFilter(query) }, { name: containsFilter(query) }],
  };
}

/**
 * Pick allowed customer profile fields from an update payload.
 *
 * @param {object} data
 * @returns {object}
 */
export function pickCustomerProfileFields(data) {
  const allowed = {};
  for (const field of CUSTOMER_PROFILE_FIELDS) {
    if (data[field] !== undefined) {
      allowed[field] = data[field];
    }
  }
  return allowed;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/**
 * Get a customer by id, including their addresses.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getCustomer(id) {
  return prisma.customer.findUnique({
    where: { id },
    include: { addresses: true },
  });
}

/**
 * Update allowed profile fields for a customer.
 * Only name, phone, and preferredLocale may be updated.
 * @param {string} id
 * @param {{ name?: string, phone?: string, preferredLocale?: string }} data
 * @returns {Promise<object>}
 */
export async function updateCustomer(id, data) {
  return prisma.customer.update({
    where: { id },
    data: pickCustomerProfileFields(data),
  });
}

/**
 * Create a customer profile.
 *
 * @param {{ email: string, name?: string|null, phone?: string|null, preferredLocale?: string|null }} data
 * @returns {Promise<object>}
 */
export async function createCustomer({
  email,
  name = null,
  phone = null,
  preferredLocale = null,
}) {
  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    throw Object.assign(
      new Error('A customer with that email already exists.'),
      { code: 'CUSTOMER_EMAIL_EXISTS' }
    );
  }

  return prisma.customer.create({
    data: {
      email,
      name,
      phone,
      ...(preferredLocale ? { preferredLocale } : {}),
    },
  });
}

/**
 * List customers with optional search and pagination.
 *
 * @param {{ page?: number, limit?: number, q?: string }} options
 * @returns {Promise<{ customers: object[], total: number }>}
 */
export async function listCustomers({ page = 1, limit = 20, q } = {}) {
  const where = buildCustomerSearchWhere(q);
  const skip = (page - 1) * limit;

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        preferredLocale: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return { customers, total };
}

// ---------------------------------------------------------------------------
// Address book
// ---------------------------------------------------------------------------

/**
 * List all addresses for a customer.
 * @param {string} customerId
 * @returns {Promise<object[]>}
 */
export async function listAddresses(customerId) {
  return prisma.address.findMany({ where: { customerId } });
}

/**
 * Add an address for a customer.
 * If isDefault=true, unsets any existing default first (in a transaction).
 * @param {string} customerId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function addAddress(customerId, data) {
  if (data.isDefault) {
    return prisma.$transaction(async (tx) => {
      await clearDefaultAddresses(tx, customerId);
      return tx.address.create({ data: { ...data, customerId } });
    });
  }

  return prisma.address.create({ data: { ...data, customerId } });
}

/**
 * Update an address.
 * If isDefault=true, unsets existing defaults for the same customer first (in a transaction).
 * @param {string} addressId
 * @param {string} customerId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateAddress(addressId, customerId, data) {
  if (data.isDefault) {
    return prisma.$transaction(async (tx) => {
      await clearDefaultAddresses(tx, customerId, addressId);
      return tx.address.update({ where: { id: addressId, customerId }, data });
    });
  }

  return prisma.address.update({ where: { id: addressId, customerId }, data });
}

/**
 * Delete an address.
 * If the deleted address was default, promotes the most recently created
 * remaining address as default.
 * @param {string} addressId
 * @param {string} customerId
 * @returns {Promise<void>}
 */
export async function deleteAddress(addressId, customerId) {
  const address = await prisma.address.findUnique({
    where: { id: addressId, customerId },
  });

  if (!address) return;

  await prisma.address.delete({ where: { id: addressId } });

  if (address.isDefault) {
    const next = await prisma.address.findFirst({
      where: { customerId },
      orderBy: { id: 'desc' },
    });

    if (next) {
      await prisma.address.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }
}

/**
 * Set an address as default, unsetting all other defaults for the same customer.
 * @param {string} addressId
 * @param {string} customerId
 * @returns {Promise<object>}
 */
export async function setDefaultAddress(addressId, customerId) {
  return prisma.$transaction(async (tx) => {
    await clearDefaultAddresses(tx, customerId, addressId);
    return tx.address.update({
      where: { id: addressId, customerId },
      data: { isDefault: true },
    });
  });
}

// ---------------------------------------------------------------------------
// Order history
// ---------------------------------------------------------------------------

/**
 * List orders for a customer with their lines, newest first.
 * @param {string} customerId
 * @param {{ page?: number, limit?: number }} options
 * @returns {Promise<{ orders: object[], total: number }>}
 */
export async function listOrders(customerId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const where = { customerId };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: CUSTOMER_ORDER_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}

/**
 * Get a full order with its lines.
 * Returns null if the order does not belong to the given customerId.
 * @param {string} orderId
 * @param {string} customerId
 * @returns {Promise<object|null>}
 */
export async function getOrder(orderId, customerId) {
  return prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: CUSTOMER_ORDER_DETAIL_INCLUDE,
  });
}
