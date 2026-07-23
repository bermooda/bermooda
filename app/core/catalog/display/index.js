// Client-safe product display helpers for themes and storefront UI.

/**
 * @param {{ slug?: string | { slug?: string } | null, id?: string }} product
 */
export function resolveProductSlug(product) {
  if (!product) return null;
  return product.slug?.slug ?? product.slug ?? product.id ?? null;
}

/**
 * @param {object} product
 */
export function resolveProductDisplayPrice(product) {
  if (!product) return null;
  if (product.displayPrice != null) return product.displayPrice;
  if (product.variantPrices?.[0]?.priceCents != null) {
    return product.variantPrices[0].priceCents;
  }
  if (product.variants?.[0]?.prices?.[0]?.priceCents != null) {
    return product.variants[0].prices[0].priceCents;
  }
  return null;
}

/**
 * @param {object} product
 */
export function resolveProductHref(product) {
  const slug = resolveProductSlug(product);
  return slug ? `/products/${slug}` : null;
}

/**
 * @param {{ prices?: Array<{ currency: string, priceCents: number }> } | null} variant
 * @param {string} currency
 */
export function pickVariantPriceForCurrency(variant, currency) {
  if (!variant?.prices?.length) return null;
  const match = variant.prices.find((price) => price.currency === currency);
  return match ?? variant.prices[0];
}

/**
 * @param {{ inventoryTracked?: boolean, inventoryCount?: number } | null} variant
 */
export function isVariantInStock(variant) {
  if (!variant) return false;
  if (!variant.inventoryTracked) return true;
  return (variant.inventoryCount ?? 0) > 0;
}

/**
 * @param {Array<{ options: Array<{ name: string, value: string }> }>} variants
 * @param {Record<string, string>} selectedOptions
 */
export function findVariantBySelectedOptions(variants, selectedOptions) {
  return (
    variants.find((variant) =>
      variant.options.every((opt) => selectedOptions[opt.name] === opt.value)
    ) ?? null
  );
}
