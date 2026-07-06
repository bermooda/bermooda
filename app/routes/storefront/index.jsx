import { useLoaderData } from 'react-router';

import { listProducts, listCategories } from '#/core/catalog/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { attachReviewSummaries } from '#/core/reviews/index.server';
import {
  buildOrganizationJsonLd,
  buildSiteMeta,
  buildWebSiteJsonLd,
} from '#/core/seo/index.server';
import { getSlotBlocksMap } from '#/core/themes/index.server';
import { preloadStorefrontTheme } from '#/core/themes/resolve.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';
import { JsonLd } from '#/components/seo/json-ld';

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);

  const [{ products: rawProducts }, categories, slotBlocks] = await Promise.all(
    [
      listProducts({ locale, currency, limit: 12, published: true }),
      listCategories({ locale }),
      getSlotBlocksMap(['home.hero', 'home.featured']),
    ]
  );

  const products = await attachReviewSummaries(rawProducts);

  const [organization, webSite, metaTags] = await Promise.all([
    buildOrganizationJsonLd(request),
    buildWebSiteJsonLd(request),
    buildSiteMeta({ request, path: '/' }),
  ]);

  return {
    themeId,
    products,
    categories,
    locale,
    currency,
    slotBlocks,
    jsonLd: [organization, webSite],
    metaTags,
  };
}

export function meta({ loaderData }) {
  if (!loaderData?.metaTags) {
    return [{ title: 'bermooda' }];
  }
  return loaderData.metaTags;
}

export default function StorefrontIndexRoute() {
  const { themeId, ...data } = useLoaderData();
  const HomePage = getStorefrontComponent('HomePage', themeId);
  if (!HomePage) throw new Error('HomePage theme component not found');
  return (
    <>
      <JsonLd data={data.jsonLd} />
      <HomePage {...data} />
    </>
  );
}
