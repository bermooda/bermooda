import { useLoaderData } from 'react-router';

import { parseStorefrontSearchParams } from '#/core/catalog/filter-params';
import { listCategories } from '#/core/catalog/index.server';
import { resolveChannelFromRequest } from '#/core/channels/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { search } from '#/core/search/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
  const url = new URL(request.url);
  const { query, sort, page, filters } = parseStorefrontSearchParams(url);

  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const channel = await resolveChannelFromRequest(request);

  const [{ products, total, facets }, categories] = await Promise.all([
    search({
      query,
      filters: { ...filters, channelId: channel.id },
      sort,
      page,
      limit: 24,
      locale,
      currency,
    }),
    listCategories({ locale }),
  ]);

  return {
    themeId,
    query,
    sort,
    page,
    filters,
    products,
    total,
    facets,
    categories,
    locale,
    currency,
  };
}

export function meta({ loaderData }) {
  const q = loaderData?.query;
  const title = q ? `Search results for "${q}"` : 'Search';
  return [{ title }, { name: 'robots', content: 'noindex' }];
}

export default function SearchRoute() {
  const { themeId, ...data } = useLoaderData();
  const SearchPage = getStorefrontComponent('SearchPage', themeId);
  if (!SearchPage) throw new Error('SearchPage theme component not found');
  return <SearchPage {...data} />;
}
