import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Link, useLocation, useNavigation } from 'react-router';

import { useT } from '#/core/i18n/index';
import {
  CatalogActiveFilters,
  CatalogFilterSidebar,
  CatalogMobileFilters,
  CatalogSortSelect,
  catalogHasFacets,
} from '#/themes/default/components/catalog-filters';
import ProductGrid from '#/themes/default/components/product-grid';
import StorefrontShell, {
  STOREFRONT_GREEN as GREEN,
} from '#/themes/default/components/storefront-chrome';

const PAGE_SIZE = 24;

export default function CollectionPage({
  collection,
  products = [],
  total = 0,
  page = 1,
  sort = 'relevance',
  filters = {},
  facets = {},
  locale,
  currency,
}) {
  const t = useT();
  const location = useLocation();
  const navigation = useNavigation();
  const pathname = location.pathname;
  const isLoading = navigation.state === 'loading';

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const hasFacets = catalogHasFacets(facets);

  function pageHref(p) {
    const params = new URLSearchParams(location.search);
    params.set('page', String(p));
    return `${pathname}?${params}`;
  }

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-stone-500">
          <Link to="/" className="hover:text-stone-900">
            {t('nav.home')}
          </Link>
          <span className="text-stone-300">/</span>
          <span className="font-medium text-stone-900">
            {collection?.title}
          </span>
        </nav>

        <div className="mb-8 border-b border-stone-200 pb-10">
          <div
            className="text-[11px] font-semibold tracking-[0.22em] uppercase"
            style={{ color: GREEN }}
          >
            Collection
          </div>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-stone-900 md:text-5xl">
            {collection?.title}
          </h1>
          {collection?.description && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-stone-600">
              {collection.description}
            </p>
          )}
        </div>

        <div className="mb-6">
          <CatalogActiveFilters
            filters={filters}
            facets={facets}
            locale={locale}
            currency={currency}
            pathname={pathname}
            clearHref={pathname}
          />
        </div>

        <div className="flex gap-10">
          {hasFacets && (
            <div className="hidden w-56 shrink-0 lg:block">
              <CatalogFilterSidebar
                facets={facets}
                filters={filters}
                currency={currency}
                locale={locale}
                pathname={pathname}
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p
                className={`text-sm text-stone-500 transition-opacity ${isLoading ? 'opacity-50' : ''}`}
              >
                {total === 0
                  ? 'No products found'
                  : `${total} ${total === 1 ? 'product' : 'products'}`}
              </p>
              <CatalogSortSelect sort={sort} pathname={pathname} />
            </div>

            <CatalogMobileFilters
              facets={facets}
              filters={filters}
              currency={currency}
              locale={locale}
              pathname={pathname}
            />

            <div
              className={`transition-opacity ${isLoading ? 'pointer-events-none opacity-40' : ''}`}
            >
              <ProductGrid
                products={products}
                locale={locale}
                currency={currency}
              />
            </div>

            {totalPages > 1 && (
              <nav className="mt-14 flex flex-wrap items-center justify-center gap-4">
                {hasPrev ? (
                  <Link
                    to={pageHref(page - 1)}
                    className="flex items-center gap-1.5 rounded-full border border-stone-400 px-5 py-2.5 text-sm font-semibold text-stone-800 transition-colors hover:border-stone-800 hover:bg-white"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Previous
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full border border-stone-200 px-5 py-2.5 text-sm text-stone-400">
                    <ChevronLeftIcon className="h-4 w-4" />
                    Previous
                  </span>
                )}

                <span className="text-sm font-medium text-stone-600">
                  Page {page} of {totalPages}
                </span>

                {hasNext ? (
                  <Link
                    to={pageHref(page + 1)}
                    className="flex items-center gap-1.5 rounded-full border border-stone-400 px-5 py-2.5 text-sm font-semibold text-stone-800 transition-colors hover:border-stone-800 hover:bg-white"
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full border border-stone-200 px-5 py-2.5 text-sm text-stone-400">
                    Next
                    <ChevronRightIcon className="h-4 w-4" />
                  </span>
                )}
              </nav>
            )}
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}
