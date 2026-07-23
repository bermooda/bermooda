import { useLoaderData } from 'react-router';

import { parseCatalogSearchParams } from '#/core/catalog/filter-params';
import { resolveChannelFromRequest } from '#/core/channels/index.server';
import { getCollectionByHandle } from '#/core/collections/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { attachReviewSummaries } from '#/core/reviews/index.server';
import { search } from '#/core/search/index.server';
import {
  buildBreadcrumbJsonLd,
  buildCollectionMeta,
} from '#/core/seo/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';
import { JsonLd } from '#/components/seo/json-ld';

export async function loader({ request, params }) {
  const themeId = await preloadStorefrontTheme();
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const channel = await resolveChannelFromRequest(request);
  const collection = await getCollectionByHandle(params.handle, {
    locale,
    publishedOnly: true,
  });

  if (!collection) {
    throw new Response('Collection not found', { status: 404 });
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
      productIds: collection.productIds,
      channelId: channel.id,
    },
    sort,
    page,
    limit: 24,
    locale,
    currency,
  });

  const products = await attachReviewSummaries(rawProducts);
  const path = `/collections/${params.handle}`;
  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'Home', url: '/' },
      { name: collection.title, url: path },
    ],
    request
  );

  return {
    themeId,
    collection: {
      id: collection.id,
      handle: collection.handle,
      title: collection.title,
      description: collection.description,
      collectionType: collection.collectionType,
    },
    products,
    total,
    page,
    sort,
    filters,
    facets,
    locale,
    currency,
    path,
    jsonLd: breadcrumb,
    metaTags: await buildCollectionMeta({ collection, request, path }),
  };
}

export function meta({ loaderData }) {
  if (!loaderData?.metaTags) return [{ title: 'Collection not found' }];
  return loaderData.metaTags;
}

export default function CollectionRoute() {
  const { themeId, ...data } = useLoaderData();
  const CollectionPage = getStorefrontComponent('CollectionPage', themeId);
  if (!CollectionPage) {
    throw new Error('CollectionPage theme component not found');
  }
  return (
    <>
      <JsonLd data={data.jsonLd} />
      <CollectionPage {...data} />
    </>
  );
}
