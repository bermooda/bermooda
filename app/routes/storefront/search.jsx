import { useLoaderData } from 'react-router';

import { listCategories } from '#/core/catalog/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { search } from '#/core/search/index.server';
import SearchPage from '#/themes/default/components/search-page';

export async function loader({ request }) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? '';
  const categoryId = url.searchParams.get('category') || undefined;
  const sort = url.searchParams.get('sort') ?? 'relevance';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const inStock = url.searchParams.get('inStock') === '1' ? true : undefined;

  const priceMinRaw = url.searchParams.get('priceMin');
  const priceMaxRaw = url.searchParams.get('priceMax');
  const priceMin = priceMinRaw ? Number(priceMinRaw) : undefined;
  const priceMax = priceMaxRaw ? Number(priceMaxRaw) : undefined;

  // Collect attribute filters: attr_Color=Red,Blue → { Color: ['Red', 'Blue'] }
  const attributes = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith('attr_')) {
      const name = key.slice(5);
      attributes[name] = value.split(',').filter(Boolean);
    }
  }

  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);

  const [{ products, total, facets }, categories] = await Promise.all([
    search({
      query,
      filters: { categoryId, priceMin, priceMax, inStock, attributes },
      sort,
      page,
      limit: 24,
      locale,
      currency,
    }),
    listCategories({ locale }),
  ]);

  return {
    query,
    sort,
    page,
    filters: { categoryId, priceMin, priceMax, inStock, attributes },
    products,
    total,
    facets,
    categories,
    locale,
    currency,
  };
}

export function meta({ data }) {
  const q = data?.query;
  const title = q ? `Search results for "${q}"` : 'Search';
  return [{ title }, { name: 'robots', content: 'noindex' }];
}

export default function SearchRoute() {
  const data = useLoaderData();
  return <SearchPage {...data} />;
}
