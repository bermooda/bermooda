import clsx from 'clsx';
import { useState } from 'react';
import { Link, useFetcher } from 'react-router';

import { useT } from '#/core/i18n/index';
import { formatPrice, Slot } from '#/core/index';
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

export default function ProductPage({ product, locale, currency }) {
  const t = useT();
  const fetcher = useFetcher();

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
          <div className="flex flex-col gap-6 lg:pt-2">
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

            {/* Add to cart form */}
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
                          Math.min(maxQty, parseInt(e.target.value, 10) || 1)
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
            <Slot name="product.afterDescription" />
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}
