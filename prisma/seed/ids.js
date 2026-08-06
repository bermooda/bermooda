/**
 * Stable demo IDs shared across seed modules.
 */

export const CATEGORY_IDS = {
  audio: 'seed-cat-audio-electronics',
  apparel: 'seed-cat-apparel',
  home: 'seed-cat-home-decor',
  kitchen: 'seed-cat-kitchenware',
  outdoor: 'seed-cat-outdoor-living',
  wellness: 'seed-cat-wellness',
  sports: 'seed-cat-sports',
  pets: 'seed-cat-pets',
  gifts: 'seed-cat-gifts',
};

export const PRODUCT_IDS = {
  bambooSpeaker: 'seed-prod-bamboo-speaker',
  organicTee: 'seed-prod-organic-tee',
  stonewareMugs: 'seed-prod-stoneware-mugs',
  ledLamp: 'seed-prod-led-desk-lamp',
  yogaMat: 'seed-prod-yoga-mat',
  hydrationPack: 'seed-prod-hydration-pack',
  herbalTea: 'seed-prod-herbal-tea',
  dogLeash: 'seed-prod-dog-leash-set',
  ceramicPots: 'seed-prod-ceramic-pots',
  legacyDemo: 'seed-demo-product',
};

export const VARIANT_IDS = {
  bambooSpeaker: 'seed-prod-bamboo-speaker-var',
  organicTee: 'seed-prod-organic-tee-var',
  stonewareMugs: 'seed-prod-stoneware-mugs-var',
  ledLamp: 'seed-prod-led-desk-lamp-var',
  yogaMat: 'seed-prod-yoga-mat-var',
  hydrationPack: 'seed-prod-hydration-pack-var',
  herbalTea: 'seed-prod-herbal-tea-var',
  dogLeash: 'seed-prod-dog-leash-set-var',
  ceramicPots: 'seed-prod-ceramic-pots-var',
  legacyDemo: 'seed-demo-variant',
};

/** Product catalog used by order/review/wishlist modules. */
export const CATALOG = [
  {
    productId: PRODUCT_IDS.bambooSpeaker,
    variantId: VARIANT_IDS.bambooSpeaker,
    title: 'Bamboo Bluetooth speaker',
    sku: 'BERM-AUDIO-001',
    priceCents: 7900,
  },
  {
    productId: PRODUCT_IDS.organicTee,
    variantId: VARIANT_IDS.organicTee,
    title: 'Organic cotton pocket tee',
    sku: 'BERM-APP-002',
    priceCents: 4200,
  },
  {
    productId: PRODUCT_IDS.stonewareMugs,
    variantId: VARIANT_IDS.stonewareMugs,
    title: 'Stoneware mug set (set of 4)',
    sku: 'BERM-KIT-003',
    priceCents: 5600,
  },
  {
    productId: PRODUCT_IDS.ledLamp,
    variantId: VARIANT_IDS.ledLamp,
    title: 'LED desk lamp (dimmable)',
    sku: 'BERM-HOM-004',
    priceCents: 6800,
  },
  {
    productId: PRODUCT_IDS.yogaMat,
    variantId: VARIANT_IDS.yogaMat,
    title: 'Cork-top yoga mat',
    sku: 'BERM-SPT-005',
    priceCents: 8900,
  },
  {
    productId: PRODUCT_IDS.hydrationPack,
    variantId: VARIANT_IDS.hydrationPack,
    title: 'Trail hydration pack (2 L)',
    sku: 'BERM-OUT-006',
    priceCents: 11200,
  },
  {
    productId: PRODUCT_IDS.herbalTea,
    variantId: VARIANT_IDS.herbalTea,
    title: 'Herbal tea collection',
    sku: 'BERM-WEL-007',
    priceCents: 3400,
  },
  {
    productId: PRODUCT_IDS.dogLeash,
    variantId: VARIANT_IDS.dogLeash,
    title: 'Woven leash & collar set',
    sku: 'BERM-PET-008',
    priceCents: 4800,
  },
  {
    productId: PRODUCT_IDS.ceramicPots,
    variantId: VARIANT_IDS.ceramicPots,
    title: 'Ceramic plant pot trio',
    sku: 'BERM-HOM-009',
    priceCents: 5200,
  },
  {
    productId: PRODUCT_IDS.legacyDemo,
    variantId: VARIANT_IDS.legacyDemo,
    title: 'Demo product',
    sku: 'DEMO-001',
    priceCents: 2999,
  },
];

export const LOCATION_IDS = {
  default: 'seed-loc-default',
  storefront: 'seed-loc-storefront',
};

export const CHANNEL_IDS = {
  online: 'seed-channel-online',
  wholesale: 'seed-channel-wholesale',
};

export const GROUP_IDS = {
  vip: 'seed-group-vip',
  wholesale: 'seed-group-wholesale',
};

export const DISCOUNT_IDS = {
  welcome10: 'seed-discount-welcome10',
  freship: 'seed-discount-freeship',
  vip15: 'seed-discount-vip15',
  summer25: 'seed-discount-summer25',
  expired: 'seed-discount-expired',
};

/**
 * Build stable customer demo IDs.
 * @param {number} index 1-based
 */
export function customerId(index) {
  return `seed-customer-${String(index).padStart(2, '0')}`;
}

/**
 * @param {number} index 1-based
 */
export function orderId(index) {
  return `seed-order-${String(index).padStart(2, '0')}`;
}

/**
 * @param {number} index 1-based
 */
export function orderNumber(index) {
  return `DEMO-${String(1000 + index)}`;
}
