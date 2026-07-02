import { useLoaderData } from 'react-router';

import { JsonLd } from '#/components/seo/json-ld';

import { listProducts, listCategories } from '#/core/catalog/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { attachReviewSummaries } from '#/core/reviews/index.server';
import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from '#/core/seo/index.server';
import { preloadStorefrontTheme } from '#/core/themes/resolve.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);

  const [{ products: rawProducts }, categories] = await Promise.all([
    listProducts({ locale, currency, limit: 12, published: true }),
    listCategories({ locale }),
  ]);

  const products = await attachReviewSummaries(rawProducts);

  const [organization, webSite] = await Promise.all([
    buildOrganizationJsonLd(request),
    Promise.resolve(buildWebSiteJsonLd(request)),
  ]);

  return {
    themeId,
    products,
    categories,
    locale,
    currency,
    jsonLd: [organization, webSite],
  };
}

export function meta() {
  return [
    { title: 'bermooda' },
    { name: 'description', content: 'Welcome to bermooda' },
  ];
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
