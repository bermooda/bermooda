/**
 * Map public API sort params to core search sort values.
 *
 * @param {string} [sortBy]
 * @param {string} [sortDir]
 * @returns {'relevance' | 'newest' | 'price_asc' | 'price_desc'}
 */
export function resolveSearchSort(sortBy = 'relevance', sortDir = 'desc') {
  const by = sortBy.toLowerCase();
  if (by === 'newest' || by === 'createdat') return 'newest';
  if (by === 'price' || by === 'pricecents') {
    return sortDir === 'asc' ? 'price_asc' : 'price_desc';
  }
  return 'relevance';
}

/**
 * Parse GET /api/v1/search query params into core search() input.
 *
 * @param {URL} url
 */
export function parsePublicSearchParams(url) {
  const query = url.searchParams.get('q') ?? '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10),
    100
  );
  const locale = url.searchParams.get('locale') ?? 'en';
  const currency = url.searchParams.get('currency') ?? 'USD';
  const categoryId = url.searchParams.get('categoryId') ?? undefined;
  const sortBy = url.searchParams.get('sortBy') ?? 'relevance';
  const sortDir = url.searchParams.get('sortDir') ?? 'desc';

  const priceMinRaw = url.searchParams.get('priceMin');
  const priceMaxRaw = url.searchParams.get('priceMax');
  const priceMin = priceMinRaw ? Number(priceMinRaw) : undefined;
  const priceMax = priceMaxRaw ? Number(priceMaxRaw) : undefined;
  const inStock = url.searchParams.get('inStock') === '1' ? true : undefined;

  return {
    query,
    page,
    limit,
    locale,
    currency,
    sort: resolveSearchSort(sortBy, sortDir),
    filters: {
      categoryId,
      priceMin: Number.isFinite(priceMin) ? priceMin : undefined,
      priceMax: Number.isFinite(priceMax) ? priceMax : undefined,
      inStock,
    },
  };
}
