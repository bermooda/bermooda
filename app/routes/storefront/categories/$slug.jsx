import { useLoaderData } from 'react-router';

import { parseCatalogSearchParams } from '#/core/catalog/filter-params';
import { getCategoryBySlug } from '#/core/catalog/index.server';
import { resolveChannelFromRequest } from '#/core/channels/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { attachReviewSummaries } from '#/core/reviews/index.server';
import { search } from '#/core/search/index.server';
import {
  buildBreadcrumbJsonLd,
  buildCategoryMeta,
} from '#/core/seo/index.server';
import { getSlotBlocksMap } from '#/core/themes/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components/index';
import { JsonLd } from '#/components/seo/json-ld';

export async function loader({ request, params }) {
  const themeId = await preloadStorefrontTheme();
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const channel = await resolveChannelFromRequest(request);
  const category = await getCategoryBySlug(params.slug, { locale });

  if (!category) {
    throw new Response('Category not found', { status: 404 });
  }

  const url = new URL(request.url);
  const { sort, page, filters } = parseCatalogSearchParams(url);

  const {
    products: rawProducts,
    total,
    facets,
  } = await search({
    query: '',
    filters: {
      ...filters,
      categoryId: category.id,
      channelId: channel.id,
    },
    sort,
    page,
    limit: 24,
    locale,
    currency,
  });

  const [products, slotBlocks] = await Promise.all([
    attachReviewSummaries(rawProducts),
    getSlotBlocksMap(['category.top']),
  ]);
  const path = `/categories/${params.slug}`;
  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'Home', url: '/' },
      { name: category.title, url: path },
    ],
    request
  );

  return {
    themeId,
    category,
    products,
    total,
    page,
    sort,
    filters: { ...filters, categoryId: category.id },
    facets,
    locale,
    currency,
    slotBlocks,
    path,
    jsonLd: breadcrumb,
    metaTags: await buildCategoryMeta({ category, request, path }),
  };
}

export function meta({ loaderData }) {
  if (!loaderData?.metaTags) return [{ title: 'Category not found' }];
  return loaderData.metaTags;
}

export default function CategoryRoute() {
  const { themeId, ...data } = useLoaderData();
  const CategoryPage = getStorefrontComponent('CategoryPage', themeId);
  if (!CategoryPage) throw new Error('CategoryPage theme component not found');
  return (
    <>
      <JsonLd data={data.jsonLd} />
      <CategoryPage {...data} />
    </>
  );
}
