import { useLoaderData } from 'react-router';

import { getProductBySlug } from '#/core/catalog/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import ProductPage from '#/themes/default/components/product-page';

export async function loader({ request, params }) {
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const product = await getProductBySlug(params.slug, { locale, currency });

  if (!product) {
    throw new Response('Product not found', { status: 404 });
  }

  return { product, locale, currency };
}

export function meta({ data }) {
  const title = data?.product?.title ?? 'Product';
  return [{ title }, { name: 'description', content: title }];
}

export default function ProductRoute() {
  const data = useLoaderData();
  return <ProductPage {...data} />;
}
