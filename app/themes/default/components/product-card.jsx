import { Link } from 'react-router';

import {
  formatPrice,
  resolveProductDisplayPrice,
  resolveProductHref,
  resolveProductSlug,
} from '#/core/index';
import { resolveCatalogMediaUrl } from '#/core/storage/media';

import {
  STOREFRONT_CREAM as CREAM,
  STOREFRONT_SAND as SAND,
} from '#/themes/default/components/storefront-chrome';

export default function ProductCard({ product, locale, currency }) {
  const imageUrl = resolveCatalogMediaUrl(product, 640);
  const priceCents = resolveProductDisplayPrice(product);
  const href = resolveProductHref(product);
  const slug = resolveProductSlug(product);

  return (
    <Link
      to={href ?? `/products/${slug}`}
      className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-stone-200/80 transition-shadow hover:shadow-lg"
    >
      {/* Image */}
      <div className="aspect-square overflow-hidden bg-stone-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-stone-300"
            style={{
              background: `linear-gradient(135deg, ${SAND}, ${CREAM})`,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 opacity-40"
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
      <div className="flex flex-1 flex-col gap-1 px-4 py-4">
        <div className="text-[10px] font-semibold tracking-[0.18em] text-stone-500 uppercase">
          Bermooda Studio
        </div>
        <h3 className="line-clamp-2 font-serif text-base leading-snug text-stone-900">
          {product.title}
        </h3>
        <p className="mt-auto pt-2 text-sm font-semibold text-stone-800">
          {priceCents != null
            ? formatPrice(priceCents, currency ?? 'USD', locale ?? 'en')
            : '—'}
        </p>
      </div>
    </Link>
  );
}
