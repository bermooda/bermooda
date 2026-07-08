import {
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Form, Link, useLocation } from 'react-router';

import { formatPrice } from '#/core/index';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export function buildCatalogHref(
  pathname,
  search,
  overrides = {},
  remove = []
) {
  const params = new URLSearchParams(search);
  for (const key of remove) {
    params.delete(key);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null || value === '') {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }
  params.delete('page');
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildAttributeHref(pathname, search, attrName, attrValue) {
  const params = new URLSearchParams(search);
  const paramKey = `attr_${attrName}`;
  const current = (params.get(paramKey) ?? '').split(',').filter(Boolean);
  const isActive = current.includes(attrValue);
  const next = isActive
    ? current.filter((v) => v !== attrValue)
    : [...current, attrValue];
  if (next.length > 0) {
    params.set(paramKey, next.join(','));
  } else {
    params.delete(paramKey);
  }
  params.delete('page');
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function CatalogActiveFilters({
  filters,
  facets,
  locale,
  currency,
  pathname,
  clearHref,
}) {
  const location = useLocation();
  const { categoryId, priceMin, priceMax, inStock, attributes = {} } = filters;
  const chips = [];

  if (categoryId) {
    const cat = facets?.categories?.find((c) => c.id === categoryId);
    chips.push({
      label: cat ? cat.name : categoryId,
      href: buildCatalogHref(pathname, location.search, {}, ['category']),
    });
  }

  if (priceMin != null || priceMax != null) {
    const minLabel =
      priceMin != null
        ? formatPrice(priceMin, currency ?? 'USD', locale ?? 'en')
        : null;
    const maxLabel =
      priceMax != null
        ? formatPrice(priceMax, currency ?? 'USD', locale ?? 'en')
        : null;
    const label =
      minLabel && maxLabel
        ? `${minLabel} – ${maxLabel}`
        : minLabel
          ? `From ${minLabel}`
          : `Up to ${maxLabel}`;
    chips.push({
      label,
      href: buildCatalogHref(pathname, location.search, {}, [
        'priceMin',
        'priceMax',
      ]),
    });
  }

  if (inStock) {
    chips.push({
      label: 'In stock',
      href: buildCatalogHref(pathname, location.search, {}, ['inStock']),
    });
  }

  for (const [name, values] of Object.entries(attributes)) {
    if (!Array.isArray(values) || values.length === 0) continue;
    for (const val of values) {
      const params = new URLSearchParams(location.search);
      const paramKey = `attr_${name}`;
      const current = (params.get(paramKey) ?? '').split(',').filter(Boolean);
      const next = current.filter((v) => v !== val);
      if (next.length > 0) {
        params.set(paramKey, next.join(','));
      } else {
        params.delete(paramKey);
      }
      params.delete('page');
      const query = params.toString();
      chips.push({
        label: `${name}: ${val}`,
        href: query ? `${pathname}?${query}` : pathname,
      });
    }
  }

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.label}
          to={chip.href}
          className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 transition-colors hover:border-stone-500 hover:bg-stone-50"
        >
          {chip.label}
          <XMarkIcon className="h-3 w-3 text-stone-400" />
        </Link>
      ))}
      <Link
        to={clearHref}
        className="text-xs font-medium text-stone-500 underline underline-offset-2 hover:text-stone-900"
      >
        Clear all
      </Link>
    </div>
  );
}

function CategoryFacet({ facets, filters, pathname }) {
  const location = useLocation();
  if (!facets?.categories?.length) return null;

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold tracking-widest text-stone-500 uppercase">
        Category
      </h3>
      <ul className="space-y-1.5">
        {facets.categories.map((cat) => {
          const isActive = filters.categoryId === cat.id;
          const href = isActive
            ? buildCatalogHref(pathname, location.search, {}, ['category'])
            : buildCatalogHref(pathname, location.search, {
                category: cat.id,
              });
          return (
            <li key={cat.id}>
              <Link
                to={href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-stone-900 font-medium text-white'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`text-xs ${isActive ? 'text-stone-300' : 'text-stone-400'}`}
                >
                  {cat.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PriceRangeFacet({ facets, filters, currency, locale, pathname }) {
  const location = useLocation();
  const { min: facetMin = 0, max: facetMax = 0 } = facets?.price ?? {};

  if (facetMax === 0) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const minVal = fd.get('priceMin');
    const maxVal = fd.get('priceMax');
    const params = new URLSearchParams(location.search);
    if (minVal) {
      params.set('priceMin', String(Math.round(Number(minVal) * 100)));
    } else {
      params.delete('priceMin');
    }
    if (maxVal) {
      params.set('priceMax', String(Math.round(Number(maxVal) * 100)));
    } else {
      params.delete('priceMax');
    }
    params.delete('page');
    window.location.href = params.toString()
      ? `${pathname}?${params}`
      : pathname;
  }

  const minDollars =
    filters.priceMin != null ? (filters.priceMin / 100).toFixed(0) : '';
  const maxDollars =
    filters.priceMax != null ? (filters.priceMax / 100).toFixed(0) : '';

  const facetMinDollars = Math.floor(facetMin / 100);
  const facetMaxDollars = Math.ceil(facetMax / 100);

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold tracking-widest text-stone-500 uppercase">
        Price
      </h3>
      <p className="mb-3 text-xs text-stone-500">
        Range: {formatPrice(facetMin, currency ?? 'USD', locale ?? 'en')} –{' '}
        {formatPrice(facetMax, currency ?? 'USD', locale ?? 'en')}
      </p>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="number"
          name="priceMin"
          defaultValue={minDollars}
          placeholder={String(facetMinDollars)}
          min={facetMinDollars}
          max={facetMaxDollars}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
        />
        <span className="shrink-0 text-stone-400">–</span>
        <input
          type="number"
          name="priceMax"
          defaultValue={maxDollars}
          placeholder={String(facetMaxDollars)}
          min={facetMinDollars}
          max={facetMaxDollars}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-stone-700 px-3 py-2 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-900 hover:text-white"
        >
          Go
        </button>
      </form>
    </div>
  );
}

function AvailabilityFacet({ facets, filters, pathname }) {
  const location = useLocation();
  const { inStock: inStockCount = 0, total = 0 } = facets?.availability ?? {};

  if (total === 0 || inStockCount === total) return null;

  const isActive = filters.inStock === true;
  const href = isActive
    ? buildCatalogHref(pathname, location.search, {}, ['inStock'])
    : buildCatalogHref(pathname, location.search, { inStock: '1' });

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold tracking-widest text-stone-500 uppercase">
        Availability
      </h3>
      <Link
        to={href}
        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive
            ? 'bg-stone-900 font-medium text-white'
            : 'text-stone-700 hover:bg-stone-100'
        }`}
      >
        <span>In stock</span>
        <span
          className={`text-xs ${isActive ? 'text-stone-300' : 'text-stone-400'}`}
        >
          {inStockCount}
        </span>
      </Link>
    </div>
  );
}

function AttributeFacets({ facets, filters, pathname }) {
  const location = useLocation();
  if (!facets?.attributes?.length) return null;

  return (
    <>
      {facets.attributes.map((attr) => {
        const activeVals = filters.attributes?.[attr.name] ?? [];
        return (
          <div key={attr.name}>
            <h3 className="mb-3 text-xs font-semibold tracking-widest text-stone-500 uppercase">
              {attr.name}
            </h3>
            <ul className="space-y-1.5">
              {attr.values.map((v) => {
                const isActive = activeVals.includes(v.value);
                const href = buildAttributeHref(
                  pathname,
                  location.search,
                  attr.name,
                  v.value
                );
                return (
                  <li key={v.value}>
                    <Link
                      to={href}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-100"
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          isActive
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-400'
                        }`}
                      >
                        {isActive && (
                          <svg
                            className="h-2.5 w-2.5"
                            viewBox="0 0 10 10"
                            fill="currentColor"
                          >
                            <path
                              d="M1.5 5L4 7.5L8.5 2.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1">{v.value}</span>
                      <span className="text-xs text-stone-400">{v.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}

export function CatalogFilterSidebar({
  facets,
  filters,
  currency,
  locale,
  pathname,
  hideCategoryFacet = false,
}) {
  const hasFacets =
    (!hideCategoryFacet && facets?.categories?.length) ||
    facets?.attributes?.length ||
    facets?.price?.max > 0 ||
    (facets?.availability?.total > 0 &&
      facets?.availability?.inStock < facets?.availability?.total);

  if (!hasFacets) return null;

  return (
    <aside className="space-y-8">
      {!hideCategoryFacet && (
        <CategoryFacet facets={facets} filters={filters} pathname={pathname} />
      )}
      <PriceRangeFacet
        facets={facets}
        filters={filters}
        currency={currency}
        locale={locale}
        pathname={pathname}
      />
      <AvailabilityFacet
        facets={facets}
        filters={filters}
        pathname={pathname}
      />
      <AttributeFacets facets={facets} filters={filters} pathname={pathname} />
    </aside>
  );
}

export function CatalogSortSelect({ sort, pathname }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-stone-500">Sort</span>
      <select
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 focus:border-stone-500 focus:outline-none"
        value={sort}
        onChange={(e) => {
          params.set('sort', e.target.value);
          params.delete('page');
          const query = params.toString();
          window.location.href = query ? `${pathname}?${query}` : pathname;
        }}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CatalogMobileFilters({
  facets,
  filters,
  currency,
  locale,
  pathname,
  hideCategoryFacet = false,
}) {
  const hasFacets =
    (!hideCategoryFacet && facets?.categories?.length) ||
    facets?.attributes?.length ||
    facets?.price?.max > 0;

  if (!hasFacets) return null;

  return (
    <details className="mb-6 rounded-xl border border-stone-200 bg-white lg:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-stone-700">
        <AdjustmentsHorizontalIcon className="h-4 w-4 text-stone-500" />
        Filters
      </summary>
      <div className="space-y-6 border-t border-stone-200 px-4 py-5">
        <CatalogFilterSidebar
          facets={facets}
          filters={filters}
          currency={currency}
          locale={locale}
          pathname={pathname}
          hideCategoryFacet={hideCategoryFacet}
        />
      </div>
    </details>
  );
}

export function CatalogSearchBar({ query, action = '/search' }) {
  return (
    <Form method="get" action={action} className="w-full">
      <div className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 focus-within:border-stone-700 focus-within:ring-2 focus-within:ring-stone-200">
        <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-stone-400" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search products…"
          autoComplete="off"
          className="flex-1 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
        />
        {query && (
          <Link
            to={action}
            className="text-stone-400 hover:text-stone-700"
            aria-label="Clear search"
          >
            <XMarkIcon className="h-4 w-4" />
          </Link>
        )}
      </div>
    </Form>
  );
}

export function catalogHasFacets(facets, { hideCategoryFacet = false } = {}) {
  return (
    (!hideCategoryFacet && facets?.categories?.length) ||
    facets?.attributes?.length ||
    facets?.price?.max > 0 ||
    (facets?.availability?.total > 0 &&
      facets?.availability?.inStock < facets?.availability?.total)
  );
}
