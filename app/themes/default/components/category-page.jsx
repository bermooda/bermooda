import { Link, useLocation, useNavigation } from 'react-router';

import { useT } from '#/core/i18n';
import SlotBlocks from '#/components/slot-blocks';

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

export default function CategoryPage({
  category,
  products = [],
  total = 0,
  page = 1,
  sort = 'relevance',
  filters = {},
  facets = {},
  locale,
  currency,
  slotBlocks = {},
}) {
  const t = useT();
  const location = useLocation();
  const navigation = useNavigation();
  const pathname = location.pathname;
  const isLoading = navigation.state === 'loading';

  const hasFacets = catalogHasFacets(facets, { hideCategoryFacet: true });
  const topSlotBlocks = slotBlocks['category.top'] ?? [];
  const slotProps = {
    category,
    products,
    total,
    page,
    sort,
    filters,
    facets,
    locale,
    currency,
  };

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-stone-500">
          <Link to="/" className="hover:text-stone-900">
            {t('nav.home')}
          </Link>
          <span className="text-stone-300">/</span>
          <span className="font-medium text-stone-900">{category?.title}</span>
        </nav>

        <div className="mb-8 border-b border-stone-200 pb-10">
          <div
            className="text-[11px] font-semibold tracking-[0.22em] uppercase"
            style={{ color: GREEN }}
          >
            Category
          </div>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-stone-900 md:text-5xl">
            {category?.title}
          </h1>
          {category?.description && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-stone-600">
              {category.description}
            </p>
          )}
        </div>

        {topSlotBlocks.length > 0 && (
          <div className="mb-6">
            <SlotBlocks blocks={topSlotBlocks} slotProps={slotProps} />
          </div>
        )}

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
                hideCategoryFacet
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
              hideCategoryFacet
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
