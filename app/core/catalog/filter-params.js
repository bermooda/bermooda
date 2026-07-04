/**
 * Parse catalog filter/sort/pagination params from a request URL.
 * Shared by search, category, and collection storefront routes.
 */
export function parseCatalogSearchParams(url) {
  const sort = url.searchParams.get('sort') ?? 'relevance';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const inStock = url.searchParams.get('inStock') === '1' ? true : undefined;

  const priceMinRaw = url.searchParams.get('priceMin');
  const priceMaxRaw = url.searchParams.get('priceMax');
  const priceMin = priceMinRaw ? Number(priceMinRaw) : undefined;
  const priceMax = priceMaxRaw ? Number(priceMaxRaw) : undefined;

  const attributes = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith('attr_')) {
      const name = key.slice(5);
      attributes[name] = value.split(',').filter(Boolean);
    }
  }

  return {
    sort,
    page,
    filters: { priceMin, priceMax, inStock, attributes },
  };
}
