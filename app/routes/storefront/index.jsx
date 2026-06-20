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
import HomePage from '#/themes/default/components/home-page';

export async function loader({ request }) {
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
  const data = useLoaderData();
  return (
    <>
      <JsonLd data={data.jsonLd} />
      <HomePage {...data} />
    </>
  );
}
