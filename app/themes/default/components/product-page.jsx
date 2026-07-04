import { HeartIcon as HeartOutlineIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { useState } from 'react';
import { Link, Form, useFetcher } from 'react-router';

import SlotBlocks from '#/components/storefront/slot-blocks';

import { useT } from '#/core/i18n/index';
import { formatPrice } from '#/core/index';
import StorefrontShell, {
  STOREFRONT_GREEN as GREEN,
} from '#/themes/default/components/storefront-chrome';

function getVariantPrice(variant, currency) {
  if (!variant?.prices?.length) return null;
  const match = variant.prices.find((p) => p.currency === currency);
  return match ?? variant.prices[0];
}

function isInStock(variant) {
  if (!variant) return false;
  if (!variant.inventoryTracked) return true;
  return variant.inventoryQuantity > 0;
}

function findVariantByOptions(variants, selectedOptions) {
  return (
    variants.find((variant) =>
      variant.options.every((opt) => selectedOptions[opt.name] === opt.value)
    ) ?? null
  );
}

function categoryHref(entry) {
  const slug =
    entry?.slug ?? entry?.category?.slug?.slug ?? entry?.category?.slug ?? null;
  return slug ? `/categories/${slug}` : null;
}

function categoryTitle(entry) {
  return entry?.title ?? entry?.category?.title ?? '';
}

export default function ProductPage({
  product,
  locale,
  currency,
  reviews,
  reviewSummary,
  reviewTotal,
  reviewPage,
  customer,
  wishlistedVariantIds = [],
  actionData,
  slotBlocks = {},
}) {
  const t = useT();
  const fetcher = useFetcher();
  const wishlistFetcher = useFetcher();
  const notifyFetcher = useFetcher();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Build initial selected options from first variant
  const initialOptions = {};
  if (product.options?.length) {
    for (const opt of product.options) {
      initialOptions[opt.name] = opt.values[0]?.value ?? '';
    }
  }
  const [selectedOptions, setSelectedOptions] = useState(initialOptions);

  const hasOptions = product.options?.length > 0;
  const selectedVariant = hasOptions
    ? findVariantByOptions(product.variants ?? [], selectedOptions)
    : (product.variants?.[0] ?? null);

  const priceEntry = getVariantPrice(selectedVariant, currency);
  const inStock = isInStock(selectedVariant);
  const isSubmitting = fetcher.state !== 'idle';
  const isWishlistBusy = wishlistFetcher.state !== 'idle';

  function isVariantWishlisted(variantId) {
    if (!variantId) return false;
    if (
      wishlistFetcher.data?.variantId === variantId &&
      wishlistFetcher.data?.wishlistOk
    ) {
      return wishlistFetcher.data.wishlistAdded;
    }
    return wishlistedVariantIds.includes(variantId);
  }

  const isWishlisted = isVariantWishlisted(selectedVariant?.id);
  const notifySuccess =
    notifyFetcher.data?.backInStockOk || actionData?.backInStockOk;
  const notifyError =
    notifyFetcher.data?.backInStockError || actionData?.backInStockError;
  const afterDescriptionBlocks = slotBlocks['product.afterDescription'] ?? [];
  const sidebarBlocks = slotBlocks['product.sidebar'] ?? [];
  const slotProps = { product, locale, currency };

  const images = product.media ?? [];
  const activeImage = images[activeImageIndex];
  const activeImageUrl = activeImage?.media?.url ?? activeImage?.url ?? null;

  function handleOptionChange(optionName, value) {
    setSelectedOptions((prev) => ({ ...prev, [optionName]: value }));
  }

  const maxQty = selectedVariant?.inventoryTracked
    ? selectedVariant.inventoryQuantity
    : 99;

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {/* Breadcrumb */}
        <nav className="mb-8 flex flex-wrap items-center gap-1.5 text-sm text-stone-500">
          <Link to="/" className="hover:text-stone-900">
            {t('nav.home')}
          </Link>
          {product.categories?.length > 0 &&
            product.categories.map((cat, i) => {
              const href = categoryHref(cat);
              const title = categoryTitle(cat);
              return (
                <span key={cat.id ?? i} className="flex items-center gap-1.5">
                  <span className="text-stone-300">/</span>
                  {href ? (
                    <Link to={href} className="hover:text-stone-900">
                      {title}
                    </Link>
                  ) : (
                    <span>{title}</span>
                  )}
                </span>
              );
            })}
          <span className="text-stone-300">/</span>
          <span className="font-medium text-stone-900">{product.title}</span>
        </nav>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Image gallery */}
          <div className="flex flex-col gap-4">
            {/* Main image */}
            <div className="aspect-square overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-stone-200/80">
              {activeImageUrl ? (
                <img
                  src={activeImageUrl}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-stone-100">
                  <span className="text-sm text-stone-400">No image</span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => {
                  const thumbUrl = img?.media?.url ?? img?.url ?? null;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setActiveImageIndex(i)}
                      className={clsx(
                        'h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors',
                        i === activeImageIndex
                          ? 'border-stone-900 ring-2 ring-stone-200'
                          : 'border-transparent hover:border-stone-300'
                      )}
                    >
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={`${product.title} ${i + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-stone-100" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product info */}
          <div
            className={clsx(
              'lg:pt-2',
              sidebarBlocks.length > 0
                ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_260px] xl:gap-8'
                : ''
            )}
          >
            <div className="flex flex-col gap-6">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.22em] text-stone-500 uppercase">
                  Bermooda Studio
                </div>
                <h1 className="mt-2 font-serif text-4xl leading-tight tracking-tight text-stone-900 md:text-5xl">
                  {product.title}
                </h1>

                {/* Price */}
                {priceEntry && (
                  <p className="mt-4 text-2xl font-semibold text-stone-900">
                    {formatPrice(
                      priceEntry.priceCents,
                      priceEntry.currency,
                      locale
                    )}
                  </p>
                )}
              </div>

              {/* Variant selectors */}
              {hasOptions &&
                product.options.map((option) => (
                  <div key={option.id}>
                    <p className="mb-2 text-sm font-semibold text-stone-800">
                      {option.name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {option.values.map((val) => (
                        <button
                          key={val.id}
                          type="button"
                          onClick={() =>
                            handleOptionChange(option.name, val.value)
                          }
                          className={clsx(
                            'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                            selectedOptions[option.name] === val.value
                              ? 'border-stone-900 bg-stone-900 text-white'
                              : 'border-stone-300 text-stone-700 hover:border-stone-500'
                          )}
                        >
                          {val.value}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

              <div className="flex flex-col gap-4">
                <fetcher.Form method="post" action="/cart">
                  <input type="hidden" name="intent" value="add" />
                  <input
                    type="hidden"
                    name="variantId"
                    value={selectedVariant?.id ?? ''}
                  />

                  <div className="flex flex-col gap-4">
                    {/* Quantity */}
                    <div>
                      <label
                        htmlFor="quantity"
                        className="mb-2 block text-sm font-semibold text-stone-800"
                      >
                        {t('product.quantity')}
                      </label>
                      <input
                        id="quantity"
                        type="number"
                        name="quantity"
                        min={1}
                        max={maxQty}
                        value={quantity}
                        onChange={(e) =>
                          setQuantity(
                            Math.max(
                              1,
                              Math.min(
                                maxQty,
                                parseInt(e.target.value, 10) || 1
                              )
                            )
                          )
                        }
                        className="w-24 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 outline-none focus:ring-2 focus:ring-stone-300"
                      />
                    </div>

                    {/* Add to cart button */}
                    <button
                      type="submit"
                      disabled={!inStock || isSubmitting || !selectedVariant}
                      className={clsx(
                        'w-full rounded-full py-3.5 px-6 text-sm font-semibold transition-all',
                        inStock && selectedVariant
                          ? 'text-white shadow-md hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-90'
                          : 'cursor-not-allowed bg-stone-200 text-stone-400'
                      )}
                      style={
                        inStock && selectedVariant
                          ? {
                              background: GREEN,
                              boxShadow: '0 8px 24px -8px rgba(47,74,58,.45)',
                            }
                          : undefined
                      }
                    >
                      {isSubmitting
                        ? t('common.loading')
                        : !inStock
                          ? t('product.outOfStock')
                          : !selectedVariant
                            ? t('product.selectVariant')
                            : t('product.addToCart')}
                    </button>
                  </div>
                </fetcher.Form>

                {/* Wishlist */}
                {customer ? (
                  <wishlistFetcher.Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value={isWishlisted ? 'wishlist-remove' : 'wishlist-add'}
                    />
                    <input
                      type="hidden"
                      name="variantId"
                      value={selectedVariant?.id ?? ''}
                    />
                    <button
                      type="submit"
                      disabled={!selectedVariant || isWishlistBusy}
                      className={clsx(
                        'flex w-full items-center justify-center gap-2 rounded-full border py-3 px-6 text-sm font-semibold transition-colors',
                        isWishlisted
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 text-stone-700 hover:border-stone-500 hover:bg-stone-50'
                      )}
                    >
                      {isWishlisted ? (
                        <HeartSolidIcon className="h-4 w-4" />
                      ) : (
                        <HeartOutlineIcon className="h-4 w-4" />
                      )}
                      {isWishlisted
                        ? t('product.removeFromWishlist')
                        : t('product.addToWishlist')}
                    </button>
                    {wishlistFetcher.data?.wishlistError && (
                      <p className="mt-2 text-sm text-red-600">
                        {wishlistFetcher.data.wishlistError}
                      </p>
                    )}
                  </wishlistFetcher.Form>
                ) : (
                  <Link
                    to={`/account/login?returnTo=${encodeURIComponent(`/products/${product.slug}`)}`}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-700 hover:border-stone-500 hover:bg-stone-50"
                  >
                    <HeartOutlineIcon className="h-4 w-4" />
                    {t('product.signInToWishlist')}
                  </Link>
                )}

                {/* Back in stock */}
                {!inStock && selectedVariant && (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-sm font-semibold text-stone-800">
                      {t('product.backInStock.title')}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">
                      {t('product.backInStock.description')}
                    </p>
                    {notifySuccess ? (
                      <p className="mt-3 text-sm text-green-700">
                        {t('product.backInStock.success')}
                      </p>
                    ) : (
                      <notifyFetcher.Form
                        method="post"
                        className="mt-3 space-y-2"
                      >
                        <input
                          type="hidden"
                          name="intent"
                          value="back-in-stock"
                        />
                        <input
                          type="hidden"
                          name="variantId"
                          value={selectedVariant.id}
                        />
                        <input
                          type="email"
                          name="email"
                          required
                          defaultValue={customer?.email ?? ''}
                          placeholder={t(
                            'product.backInStock.emailPlaceholder'
                          )}
                          className="w-full rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 outline-none focus:ring-2 focus:ring-stone-300"
                        />
                        {notifyError && (
                          <p className="text-sm text-red-600">{notifyError}</p>
                        )}
                        <button
                          type="submit"
                          disabled={notifyFetcher.state !== 'idle'}
                          className="w-full rounded-full border border-stone-900 bg-white py-2.5 text-sm font-semibold text-stone-900 hover:bg-stone-100"
                        >
                          {notifyFetcher.state !== 'idle'
                            ? t('common.loading')
                            : t('product.backInStock.submit')}
                        </button>
                      </notifyFetcher.Form>
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div className="border-t border-stone-200 pt-8">
                  <h2 className="mb-4 text-[11px] font-semibold tracking-[0.22em] text-stone-500 uppercase">
                    {t('product.description')}
                  </h2>
                  <div
                    className="prose prose-sm prose-stone max-w-none text-stone-600"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                </div>
              )}

              {/* Slot: after description */}
              <SlotBlocks
                blocks={afterDescriptionBlocks}
                slotProps={slotProps}
              />

              {/* Reviews */}
              <ProductReviewsSection
                reviews={reviews}
                reviewSummary={reviewSummary}
                reviewTotal={reviewTotal}
                reviewPage={reviewPage}
                customer={customer}
                productSlug={product.slug}
                actionData={actionData}
              />
            </div>

            {sidebarBlocks.length > 0 && (
              <aside className="mt-8 xl:mt-0">
                <div className="xl:sticky xl:top-28">
                  <SlotBlocks blocks={sidebarBlocks} slotProps={slotProps} />
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}

function StarDisplay({ rating }) {
  const full = Math.floor(rating);
  return (
    <span className="text-[#c2913a]">
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)}
    </span>
  );
}

function ProductReviewsSection({
  reviews = [],
  reviewSummary = { averageRating: 0, count: 0 },
  reviewTotal = 0,
  reviewPage = 1,
  customer,
  productSlug: _productSlug,
  actionData,
}) {
  return (
    <div className="border-t border-stone-200 pt-8">
      <h2 className="mb-4 text-[11px] font-semibold tracking-[0.22em] text-stone-500 uppercase">
        Customer Reviews
      </h2>

      {reviewSummary.count > 0 ? (
        <p className="mb-6 text-sm text-stone-600">
          <StarDisplay rating={reviewSummary.averageRating} />{' '}
          {reviewSummary.averageRating.toFixed(1)} · {reviewSummary.count}{' '}
          reviews
        </p>
      ) : (
        <p className="mb-6 text-sm text-stone-500">No reviews yet.</p>
      )}

      {reviews.length > 0 && (
        <ul className="mb-8 space-y-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-lg border border-stone-200 bg-white p-4"
            >
              <div className="flex items-center gap-2 text-sm">
                <StarDisplay rating={review.rating} />
                {review.verifiedPurchase && (
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                    Verified purchase
                  </span>
                )}
              </div>
              {review.title && (
                <p className="mt-1 font-medium text-stone-900">
                  {review.title}
                </p>
              )}
              <p className="mt-1 text-sm text-stone-600">{review.body}</p>
              <p className="mt-2 text-xs text-stone-400">
                {review.customer?.name || 'Customer'}
              </p>
            </li>
          ))}
        </ul>
      )}

      {customer ? (
        <Form
          method="post"
          className="space-y-3 rounded-lg border border-stone-200 bg-white p-4"
        >
          <input type="hidden" name="intent" value="review" />
          <p className="text-sm font-semibold text-stone-800">Write a review</p>
          {actionData?.reviewError && (
            <p className="text-sm text-red-600">{actionData.reviewError}</p>
          )}
          {actionData?.reviewOk && (
            <p className="text-sm text-green-600">
              Thanks! Your review is pending moderation.
            </p>
          )}
          <div>
            <label className="text-xs text-stone-500">Rating</label>
            <select
              name="rating"
              required
              className="mt-1 block w-full max-w-xs rounded-md border border-stone-300 px-3 py-2 text-sm"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} stars
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500">Title (optional)</label>
            <input
              name="title"
              type="text"
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-stone-500">Review</label>
            <textarea
              name="body"
              required
              rows={3}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-full px-4 py-2 text-sm font-semibold text-white"
            style={{ background: GREEN }}
          >
            Submit review
          </button>
        </Form>
      ) : (
        <p className="text-sm text-stone-600">
          <Link
            to="/account/login"
            className="font-medium text-stone-900 underline"
          >
            Sign in
          </Link>{' '}
          to leave a review.
        </p>
      )}

      {reviewTotal > 5 && (
        <div className="mt-4 flex gap-2 text-sm">
          {reviewPage > 1 && (
            <Link
              to={`?reviewPage=${reviewPage - 1}`}
              className="text-stone-600 underline"
            >
              Previous
            </Link>
          )}
          {reviewPage * 5 < reviewTotal && (
            <Link
              to={`?reviewPage=${reviewPage + 1}`}
              className="text-stone-600 underline"
            >
              More reviews
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
