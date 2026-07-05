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
  const lines = (cart?.lines ?? []).filter((line) => line.variantId);
  if (lines.length === 0) return false;

  const variantIds = lines.map((line) => line.variantId);
  const [levels, variants] = await Promise.all([
    prisma.inventoryLevel.findMany({
      where: {
        locationId,
        variantId: { in: variantIds },
      },
      include: { variant: { select: { inventoryTracked: true } } },
    }),
    prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, inventoryTracked: true },
    }),
  ]);

  const levelByVariant = new Map(
    levels.map((level) => [level.variantId, level])
  );
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  for (const line of lines) {
    const variant = variantById.get(line.variantId);
    if (!variant?.inventoryTracked) continue;

    const level = levelByVariant.get(line.variantId);
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
