import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router';

import { STOREFRONT_CATALOG_PAGE_SIZE } from '#/core/catalog/filter-params';

export default function CatalogPagination({
  page,
  total,
  pathname,
  search = '',
  pageSize = STOREFRONT_CATALOG_PAGE_SIZE,
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  function pageHref(nextPage) {
    const params = new URLSearchParams(search);
    params.set('page', String(nextPage));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <nav
      className="mt-10 flex items-center justify-center gap-4"
      aria-label="Pagination"
    >
      {hasPrev ? (
        <Link
          to={pageHref(page - 1)}
          className="flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Previous
        </Link>
      ) : (
        <span className="flex items-center gap-1 text-sm text-stone-300">
          <ChevronLeftIcon className="h-4 w-4" />
          Previous
        </span>
      )}
      <span className="text-sm text-stone-500">
        Page {page} of {totalPages}
      </span>
      {hasNext ? (
        <Link
          to={pageHref(page + 1)}
          className="flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          Next
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      ) : (
        <span className="flex items-center gap-1 text-sm text-stone-300">
          Next
          <ChevronRightIcon className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
