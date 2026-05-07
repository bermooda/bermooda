import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router';

import { useT } from '#/core/i18n/index';
import ProductGrid from '#/themes/default/components/product-grid';

const PAGE_SIZE = 24;

export default function CategoryPage({
  category,
  products = [],
  total = 0,
  page = 1,
  locale,
  currency,
}) {
  const t = useT();
  const location = useLocation();

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  function pageHref(p) {
    const params = new URLSearchParams(location.search);
    params.set('page', String(p));
    return `${location.pathname}?${params}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-sm text-zinc-500">
        <Link to="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          {t('nav.home')}
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100">
          {category?.title}
        </span>
      </nav>

      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          {category?.title}
        </h1>
        {category?.description && (
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {category.description}
          </p>
        )}
        <p className="mt-1 text-sm text-zinc-500">
          {total} {total === 1 ? 'product' : 'products'}
        </p>
      </div>

      {/* Products */}
      <ProductGrid products={products} locale={locale} currency={currency} />

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-4">
          {hasPrev ? (
            <Link
              to={pageHref(page - 1)}
              className="flex items-center gap-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Previous
            </Link>
          ) : (
            <span className="flex items-center gap-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-400">
              <ChevronLeftIcon className="h-4 w-4" />
              Previous
            </span>
          )}

          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Page {page} of {totalPages}
          </span>

          {hasNext ? (
            <Link
              to={pageHref(page + 1)}
              className="flex items-center gap-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Next
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          ) : (
            <span className="flex items-center gap-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-400">
              Next
              <ChevronRightIcon className="h-4 w-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
