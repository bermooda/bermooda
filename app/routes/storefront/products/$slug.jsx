import { useActionData, useLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';
import { JsonLd } from '#/components/seo/json-ld';

import { getProductBySlug } from '#/core/catalog/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import {
  createReview,
  getReviewSummary,
  listReviewsForProduct,
} from '#/core/reviews/index.server';
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  buildProductMeta,
} from '#/core/seo/index.server';
import ProductPage from '#/themes/default/components/product-page';

export async function loader({ request, params }) {
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const product = await getProductBySlug(params.slug, { locale, currency });

  if (!product) {
    throw new Response('Product not found', { status: 404 });
  }

  const url = new URL(request.url);
  const reviewPage = Math.max(
    1,
    parseInt(url.searchParams.get('reviewPage') ?? '1', 10)
  );

  const session = await getCustomerSession(request);
  const [{ reviews, total: reviewTotal }, reviewSummary] = await Promise.all([
    listReviewsForProduct(product.id, {
      status: 'approved',
      page: reviewPage,
      limit: 5,
    }),
    getReviewSummary(product.id),
  ]);

  const path = `/products/${params.slug}`;
  const category = product.categories?.[0];
  const categoryTitle = category?.title ?? category?.category?.title;
  const categorySlug = category?.slug ?? category?.category?.slug;

  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'Home', url: '/' },
      ...(categoryTitle && categorySlug
        ? [{ name: categoryTitle, url: `/categories/${categorySlug}` }]
        : []),
      { name: product.title, url: path },
    ],
    request
  );

  const productJsonLd = buildProductJsonLd(product, {
    locale,
    currency,
    request,
    reviewSummary,
  });

  return {
    product,
    locale,
    currency,
    reviews,
    reviewTotal,
    reviewPage,
    reviewSummary,
    customer: session?.user ?? null,
    path,
    jsonLd: [breadcrumb, productJsonLd],
    metaTags: await buildProductMeta({ product, request, path }),
  };
}

export async function action({ request, params }) {
  const formData = await request.formData();
  if (formData.get('intent') !== 'review') return null;

  const session = await getCustomerSession(request);
  if (!session?.user?.id) {
    return { reviewError: 'Sign in to leave a review.' };
  }

  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const product = await getProductBySlug(params.slug, { locale, currency });
  if (!product) {
    return { reviewError: 'Product not found.' };
  }

  try {
    await createReview({
      productId: product.id,
      customerId: session.user.id,
      rating: formData.get('rating'),
      title: formData.get('title')?.toString(),
      body: formData.get('body')?.toString(),
    });
    return { reviewOk: true };
  } catch (err) {
    return { reviewError: err.message ?? 'Could not submit review.' };
  }
}

export function meta({ data }) {
  if (!data?.metaTags) return [{ title: 'Product not found' }];
  return data.metaTags;
}

export default function ProductRoute() {
  const data = useLoaderData();
  const actionData = useActionData();

  return (
    <>
      <JsonLd data={data.jsonLd} />
      <ProductPage {...data} reviewActionData={actionData} />
    </>
  );
}
