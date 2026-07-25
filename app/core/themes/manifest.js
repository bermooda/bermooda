// Shared theme manifest constants (client-safe).

/** Required top-level fields in a theme manifest. */
export const REQUIRED_MANIFEST_FIELDS = [
  'id',
  'title',
  'version',
  'slug',
  'components',
];

/** Required component names that every theme must supply. */
export const REQUIRED_COMPONENTS = [
  'Layout',
  'HomePage',
  'ProductPage',
  'CategoryPage',
  'CartPage',
  'CheckoutLayout',
  'NotFoundPage',
];

/**
 * Well-known slot names available for plugin blocks.
 * @type {string[]}
 */
export const SLOT_NAMES = [
  'home.hero',
  'home.featured',
  'product.afterDescription',
  'product.sidebar',
  'category.top',
  'cart.summary',
  'checkout.afterPayment',
  'account.dashboard',
  'layout.header',
  'layout.footer',
];
