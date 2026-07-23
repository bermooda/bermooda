/**
 * Parse shared GET query params for public catalog list endpoints.
 *
 * @param {URL} url
 */
export function parsePublicCatalogListParams(url) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10),
    100
  );
  const locale = url.searchParams.get('locale') ?? 'en';
  const currency = url.searchParams.get('currency') ?? 'USD';
  const categoryId = url.searchParams.get('categoryId') ?? undefined;

  return { page, limit, locale, currency, categoryId };
}

/**
 * Parse locale + currency query params for public catalog detail endpoints.
 *
 * @param {URL} url
 */
export function parsePublicCatalogDetailParams(url) {
  const locale = url.searchParams.get('locale') ?? 'en';
  const currency = url.searchParams.get('currency') ?? 'USD';
  return { locale, currency };
}

/**
 * Parse locale query param for public category list endpoints.
 *
 * @param {URL} url
 */
export function parsePublicCategoryListParams(url) {
  return { locale: url.searchParams.get('locale') ?? 'en' };
}
