import clsx from 'clsx';
import { useState } from 'react';
import { useFetcher } from 'react-router';

import { useT } from '#/core/i18n/index.js';
import { formatPrice, Slot } from '#/core/index.js';

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

  function handleOptionChange(optionName, value) {
    setSelectedOptions((prev) => ({ ...prev, [optionName]: value }));
  }

  const maxQty = selectedVariant?.inventoryTracked
    ? selectedVariant.inventoryQuantity
    : 99;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      {product.categories?.length > 0 && (
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          {product.categories.map((cat, i) => (
            <span key={cat.id} className="flex items-center gap-2">
              {i > 0 && <span>/</span>}
              <span>{cat.title}</span>
            </span>
          ))}
          <span>/</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {product.title}
          </span>
        </nav>
      )}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Image gallery */}
        <div className="flex flex-col gap-4">
          {/* Main image */}
          <div className="aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
            {activeImage ? (
              <img
                src={activeImage.url}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-sm text-gray-400 dark:text-gray-600">
                  No image
                </span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImageIndex(i)}
                  className={clsx(
                    'w-16 h-16 rounded-md overflow-hidden border-2 transition-colors',
                    i === activeImageIndex
                      ? 'border-gray-900 dark:border-white'
                      : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <img
                    src={img.url}
                    alt={`${product.title} ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl leading-tight font-bold text-gray-900 dark:text-white">
              {product.title}
            </h1>

            {/* Price */}
            {priceEntry && (
              <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
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
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {option.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((val) => (
                    <button
                      key={val.id}
                      onClick={() => handleOptionChange(option.name, val.value)}
                      className={clsx(
                        'px-4 py-2 rounded-md border text-sm font-medium transition-colors',
                        selectedOptions[option.name] === val.value
                          ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-500 dark:hover:border-gray-400'
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
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
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
                  className="w-20 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-white"
                />
              </div>

              {/* Add to cart button */}
              <button
                type="submit"
                disabled={!inStock || isSubmitting || !selectedVariant}
                className={clsx(
                  'w-full py-3 px-6 rounded-lg font-semibold text-sm transition-colors',
                  inStock && selectedVariant
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                )}
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
            <div>
              <h2 className="mb-3 text-sm font-medium tracking-wide text-gray-700 uppercase dark:text-gray-300">
                {t('product.description')}
              </h2>
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}

          {/* Slot: after description */}
          <Slot name="product.afterDescription" />
        </div>
      </div>
    </div>
  );
}
