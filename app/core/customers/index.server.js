// app/core/customers/index.server.js
// Customer service: profile, address book, and order history.
// Auth is handled by better-auth (app/libs/auth/customer.server.js).
// This service is data-only — no auth imports.

import prisma from '#/libs/prisma.server';

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
  const { name, phone, preferredLocale } = data;
  const allowed = {};
  if (name !== undefined) allowed.name = name;
  if (phone !== undefined) allowed.phone = phone;
  if (preferredLocale !== undefined) allowed.preferredLocale = preferredLocale;

  return prisma.customer.update({ where: { id }, data: allowed });
}

/**
 * Get a customer by email.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
export async function getCustomerByEmail(email) {
  return prisma.customer.findUnique({ where: { email } });
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
      await tx.address.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
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
      await tx.address.updateMany({
        where: { customerId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
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
    await tx.address.updateMany({
      where: { customerId, isDefault: true, id: { not: addressId } },
      data: { isDefault: false },
    });
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
 * @returns {Promise<object[]>}
 */
export async function listOrders(customerId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;

  return prisma.order.findMany({
    where: { customerId },
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
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
    include: { lines: true },
  });
}
