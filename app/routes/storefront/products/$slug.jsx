import { useActionData, useLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer/index.server';
import {
  parseSubscribeFromForm,
  subscribeBackInStock,
} from '#/core/back-in-stock/index.server';
import { getProductBySlug } from '#/core/catalog/index.server';
import { resolveChannelFromRequest } from '#/core/channels/index.server';
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
import { getSlotBlocksMap } from '#/core/themes/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components/index';
import {
  addToWishlist,
  getWishlistedVariantIds,
  mapWishlistActionError,
  parseWishlistFromForm,
  removeFromWishlist,
} from '#/core/wishlists/index.server';
import { JsonLd } from '#/components/seo/json-ld';

export async function loader({ request, params }) {
  const themeId = await preloadStorefrontTheme();
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const channel = await resolveChannelFromRequest(request);
  const product = await getProductBySlug(params.slug, {
    locale,
    currency,
    channelId: channel.id,
  });

  if (!product) {
    throw new Response('Product not found', { status: 404 });
  }

  const url = new URL(request.url);
  const reviewPage = Math.max(
    1,
    parseInt(url.searchParams.get('reviewPage') ?? '1', 10)
  );

  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;
  const wishlistedVariantIds = customer
    ? await getWishlistedVariantIds(customer.id, product.id)
    : [];

  const [{ reviews, total: reviewTotal }, reviewSummary, slotBlocks] =
    await Promise.all([
      listReviewsForProduct(product.id, {
        status: 'approved',
        page: reviewPage,
        limit: 5,
      }),
      getReviewSummary(product.id),
      getSlotBlocksMap(['product.afterDescription', 'product.sidebar']),
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
    themeId,
    product,
    locale,
    currency,
    reviews,
    reviewTotal,
    reviewPage,
    reviewSummary,
    customer,
    wishlistedVariantIds,
    path,
    slotBlocks,
    jsonLd: [breadcrumb, productJsonLd],
    metaTags: await buildProductMeta({ product, request, path }),
  };
}

export async function action({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  if (intent === 'review') {
    const session = await getCustomerSession(request);
    if (!session?.user?.id) {
      return { reviewError: 'Sign in to leave a review.' };
    }

    const locale = await getRequestLocale(request);
    const currency = await getRequestCurrency(request);
    const channel = await resolveChannelFromRequest(request);
    const product = await getProductBySlug(params.slug, {
      locale,
      currency,
      channelId: channel.id,
    });
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

  if (intent === 'wishlist-add' || intent === 'wishlist-remove') {
    const session = await getCustomerSession(request);
    if (!session?.user?.id) {
      return { wishlistError: 'Sign in to save items to your wishlist.' };
    }

    try {
      const { variantId, intent: wishlistIntent } = parseWishlistFromForm(
        formData,
        { customerId: session.user.id }
      );

      if (wishlistIntent === 'add') {
        await addToWishlist(session.user.id, variantId);
        return { wishlistOk: true, wishlistAdded: true, variantId };
      }

      await removeFromWishlist(session.user.id, variantId);
      return { wishlistOk: true, wishlistAdded: false, variantId };
    } catch (err) {
      return mapWishlistActionError(err);
    }
  }

  if (intent === 'back-in-stock') {
    const session = await getCustomerSession(request);

    try {
      const input = parseSubscribeFromForm(formData, {
        customerId: session?.user?.id ?? null,
      });
      await subscribeBackInStock(input);
      return { backInStockOk: true };
    } catch (err) {
      if (err.code === 'VARIANT_ID_REQUIRED') {
        return { backInStockError: 'Select a variant first.' };
      }
      if (err.code === 'EMAIL_REQUIRED') {
        return { backInStockError: 'Enter your email address.' };
      }
      return { backInStockError: 'Could not subscribe. Try again.' };
    }
  }

  return null;
}

export function meta({ loaderData }) {
  if (!loaderData?.metaTags) return [{ title: 'Product not found' }];
  return loaderData.metaTags;
}

export default function ProductRoute() {
  const { themeId, ...data } = useLoaderData();
  const actionData = useActionData();
  const ProductPage = getStorefrontComponent('ProductPage', themeId);
  if (!ProductPage) throw new Error('ProductPage theme component not found');

  return (
    <>
      <JsonLd data={data.jsonLd} />
      <ProductPage {...data} actionData={actionData} />
    </>
  );
}
