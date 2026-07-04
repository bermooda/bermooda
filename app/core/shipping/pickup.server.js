// app/core/shipping/pickup.server.js
// BOPIS (buy online, pick up in store) shipping provider.

import prisma from '#/libs/prisma.server';

/**
 * Return true when every cart line has sufficient stock at the location.
 *
 * @param {object} cart
 * @param {string} locationId
 */
async function cartAvailableAtLocation(cart, locationId) {
  const lines = cart?.lines ?? [];
  if (lines.length === 0) return false;

  for (const line of lines) {
    if (!line.variantId) continue;

    const level = await prisma.inventoryLevel.findUnique({
      where: {
        variantId_locationId: {
          variantId: line.variantId,
          locationId,
        },
      },
      include: { variant: { select: { inventoryTracked: true } } },
    });

    if (!level?.variant.inventoryTracked) continue;

    if (!level || level.quantity < line.quantity) {
      return false;
    }
  }

  return true;
}

function parseAddress(addressJson) {
  if (!addressJson) return null;
  try {
    return JSON.parse(addressJson);
  } catch {
    return null;
  }
}

/**
 * Built-in pickup provider — free shipping from store locations with stock.
 */
export const pickupProvider = {
  name: 'Store Pickup',

  /**
   * @param {{ cart: object, shippingAddress: object }} params
   * @returns {Promise<object[]>}
   */
  async getQuotes({ cart }) {
    const locations = await prisma.location.findMany({
      where: { active: true, allowsPickup: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    const quotes = [];

    for (const location of locations) {
      const available = await cartAvailableAtLocation(cart, location.id);
      if (!available) continue;

      const address = parseAddress(location.addressJson);
      quotes.push({
        id: `pickup:${location.id}`,
        providerId: 'pickup',
        name: `Pick up at ${location.name}`,
        priceCents: 0,
        estimatedDays: 0,
        pickupLocationId: location.id,
        pickupLocationName: location.name,
        pickupAddress: address,
      });
    }

    return quotes;
  },
};
