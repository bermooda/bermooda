import { Link } from 'react-router';

import { formatPrice } from '#/core/index';

function resolvePrice(product) {
  if (product.displayPrice != null) return product.displayPrice;
  if (product.variantPrices?.[0]?.priceCents != null)
    return product.variantPrices[0].priceCents;
  if (product.variants?.[0]?.prices?.[0]?.priceCents != null)
    return product.variants[0].prices[0].priceCents;
  return null;
}

function resolveSlug(product) {
  return product.slug?.slug ?? product.slug ?? product.id;
}

export default function ProductCard({ product, locale, currency }) {
  const imageUrl = product.media?.[0]?.media?.url ?? null;
  const priceCents = resolvePrice(product);
  const slug = resolveSlug(product);

  return (
    <Link
      to={`/products/${slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-gray-100 bg-white transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-600"
    >
      {/* Image */}
      <div className="aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-white">
          {product.title}
        </h3>
        <p className="mt-auto pt-2 text-sm text-gray-500 dark:text-gray-400">
          {priceCents != null
            ? formatPrice(priceCents, currency ?? 'USD', locale ?? 'en')
            : '—'}
        </p>
      </div>
    </Link>
  );
}
