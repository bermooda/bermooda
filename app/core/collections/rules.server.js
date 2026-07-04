// app/core/collections/rules.server.js
// Smart collection rule parsing and product matching.

/**
 * @typedef {{ type: string, value: string|number|boolean }} CollectionCondition
 * @typedef {{ match?: 'all'|'any', conditions?: CollectionCondition[] }} CollectionRules
 */

/**
 * @param {string|CollectionRules|null|undefined} rulesJson
 * @returns {CollectionRules}
 */
export function parseCollectionRules(rulesJson) {
  try {
    const parsed =
      typeof rulesJson === 'string' ? JSON.parse(rulesJson) : rulesJson;
    if (!parsed || typeof parsed !== 'object') {
      return { match: 'all', conditions: [] };
    }
    return {
      match: parsed.match === 'any' ? 'any' : 'all',
      conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
    };
  } catch {
    return { match: 'all', conditions: [] };
  }
}

function getMinVariantPrice(product, currency) {
  const prices = [];
  for (const variant of product.variants ?? []) {
    for (const price of variant.prices ?? []) {
      if (currency && price.currency !== currency) continue;
      prices.push(price.priceCents);
    }
  }
  return prices.length ? Math.min(...prices) : null;
}

function productHasTag(product, tagName) {
  const normalized = String(tagName).trim();
  if (!normalized) return false;

  for (const assignment of product.tags ?? []) {
    const name = assignment.tag?.name ?? assignment.name;
    if (name === normalized) return true;
  }
  return false;
}

function productInCategory(product, categoryId) {
  const normalized = String(categoryId).trim();
  if (!normalized) return false;

  for (const row of product.categories ?? []) {
    const id = row.categoryId ?? row.category?.id;
    if (id === normalized) return true;
  }
  return false;
}

function productInStock(product) {
  return (product.variants ?? []).some(
    (variant) => !variant.inventoryTracked || variant.inventoryCount > 0
  );
}

/**
 * @param {object} product
 * @param {CollectionCondition} condition
 * @param {{ currency?: string }} [options]
 */
function evaluateCondition(product, condition, { currency } = {}) {
  const { type, value } = condition ?? {};

  switch (type) {
    case 'tag':
      return productHasTag(product, value);
    case 'category':
      return productInCategory(product, value);
    case 'price_min': {
      const minPrice = getMinVariantPrice(product, currency);
      return minPrice != null && minPrice >= Number(value);
    }
    case 'price_max': {
      const minPrice = getMinVariantPrice(product, currency);
      return minPrice != null && minPrice <= Number(value);
    }
    case 'in_stock': {
      const wantsInStock =
        value === true || value === 'true' || value === '1' || value === 1;
      const inStock = productInStock(product);
      return wantsInStock ? inStock : !inStock;
    }
    default:
      return false;
  }
}

/**
 * @param {object} product
 * @param {CollectionRules} rules
 * @param {{ currency?: string }} [options]
 */
export function productMatchesCollectionRules(product, rules, options = {}) {
  const parsed = parseCollectionRules(rules);
  const { match, conditions } = parsed;
  if (!conditions.length) return true;

  const results = conditions.map((condition) =>
    evaluateCondition(product, condition, options)
  );
  return match === 'any' ? results.some(Boolean) : results.every(Boolean);
}
