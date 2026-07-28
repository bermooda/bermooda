import { Link, useLocation, useNavigation } from 'react-router';

import { useT } from '#/core/i18n';

import {
  CatalogActiveFilters,
  CatalogFilterSidebar,
  CatalogMobileFilters,
  CatalogSortSelect,
  catalogHasFacets,
} from './catalog-filters';
import CatalogPagination from './catalog-pagination';
import ProductGrid from './product-grid';
import StorefrontShell, {
  STOREFRONT_GREEN as GREEN,
} from './storefront-chrome';

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

  const hasFacets = catalogHasFacets(facets);

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

            <CatalogPagination
              page={page}
              total={total}
              pathname={pathname}
              search={location.search}
            />
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}
