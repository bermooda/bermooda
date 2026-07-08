import { useLocation, useNavigation } from 'react-router';

import {
  CatalogActiveFilters,
  CatalogFilterSidebar,
  CatalogMobileFilters,
  CatalogSearchBar,
  CatalogSortSelect,
  catalogHasFacets,
} from '#/themes/default/components/catalog-filters';
import CatalogPagination from '#/themes/default/components/catalog-pagination';
import ProductGrid from '#/themes/default/components/product-grid';
import StorefrontShell, {
  STOREFRONT_GREEN as GREEN,
} from '#/themes/default/components/storefront-chrome';

export default function SearchPage({
  query = '',
  sort = 'relevance',
  page = 1,
  filters = {},
  products = [],
  total = 0,
  facets = {},
  locale,
  currency,
}) {
  const location = useLocation();
  const navigation = useNavigation();
  const pathname = '/search';
  const isSearching = navigation.state === 'loading';
  const hasFacets = catalogHasFacets(facets);

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-8">
          <div
            className="text-[11px] font-semibold tracking-[0.22em] uppercase"
            style={{ color: GREEN }}
          >
            Search
          </div>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-stone-900 md:text-4xl">
            {query ? `Results for "${query}"` : 'Browse Products'}
          </h1>
        </div>

        <div className="mb-6">
          <CatalogSearchBar query={query} />
        </div>

        <div className="mb-6">
          <CatalogActiveFilters
            filters={filters}
            facets={facets}
            locale={locale}
            currency={currency}
            pathname={pathname}
            clearHref="/search"
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
                className={`text-sm text-stone-500 transition-opacity ${isSearching ? 'opacity-50' : ''}`}
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
              className={`transition-opacity ${isSearching ? 'pointer-events-none opacity-40' : ''}`}
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
