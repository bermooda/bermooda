/**
 * Inventory locations and per-variant levels.
 */

import { LOCATION_IDS } from './ids.js';

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function seedInventory(prisma) {
  const defaultLocation = await prisma.location.upsert({
    where: { code: 'default' },
    create: {
      id: LOCATION_IDS.default,
      name: 'Default Warehouse',
      code: 'default',
      isDefault: true,
      allowsPickup: false,
      active: true,
      addressJson: JSON.stringify({
        line1: '500 Industrial Blvd',
        city: 'Oakland',
        state: 'CA',
        postalCode: '94607',
        country: 'US',
      }),
    },
    update: {
      isDefault: true,
      active: true,
      name: 'Default Warehouse',
    },
  });

  const storefront = await prisma.location.upsert({
    where: { code: 'storefront' },
    create: {
      id: LOCATION_IDS.storefront,
      name: 'SF Storefront',
      code: 'storefront',
      isDefault: false,
      allowsPickup: true,
      active: true,
      addressJson: JSON.stringify({
        line1: '123 Market Street',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'US',
      }),
    },
    update: {
      active: true,
      allowsPickup: true,
      name: 'SF Storefront',
    },
  });

  const variants = await prisma.productVariant.findMany({
    select: { id: true, inventoryCount: true },
  });

  for (const variant of variants) {
    await prisma.inventoryLevel.upsert({
      where: {
        variantId_locationId: {
          variantId: variant.id,
          locationId: defaultLocation.id,
        },
      },
      create: {
        variantId: variant.id,
        locationId: defaultLocation.id,
        quantity: variant.inventoryCount,
      },
      update: { quantity: variant.inventoryCount },
    });

    // Small pickup stock at storefront
    const pickupQty = Math.max(2, Math.floor(variant.inventoryCount / 20));
    await prisma.inventoryLevel.upsert({
      where: {
        variantId_locationId: {
          variantId: variant.id,
          locationId: storefront.id,
        },
      },
      create: {
        variantId: variant.id,
        locationId: storefront.id,
        quantity: pickupQty,
      },
      update: { quantity: pickupQty },
    });
  }

  // Tax classes
  await prisma.taxClass.upsert({
    where: { code: 'standard' },
    create: {
      id: 'seed-tax-standard',
      name: 'Standard',
      code: 'standard',
      rate: 0.0875,
    },
    update: { name: 'Standard', rate: 0.0875 },
  });
  await prisma.taxClass.upsert({
    where: { code: 'reduced' },
    create: {
      id: 'seed-tax-reduced',
      name: 'Reduced',
      code: 'reduced',
      rate: 0.05,
    },
    update: { name: 'Reduced', rate: 0.05 },
  });

  console.log(
    `Seeded ${2} locations, inventory levels for ${variants.length} variants, and tax classes.`
  );
}
