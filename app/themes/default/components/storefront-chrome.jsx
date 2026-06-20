import {
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Form, Link, useRouteLoaderData } from 'react-router';

import { useT } from '#/core/i18n/index';
import CurrencySwitcher from '#/themes/default/components/currency-switcher';
import LocaleSwitcher from '#/themes/default/components/locale-switcher';

export const STOREFRONT_GREEN = '#2f4a3a';
export const STOREFRONT_CREAM = '#f7f1e6';
export const STOREFRONT_SAND = '#e8dcc4';
export const STOREFRONT_PAGE_BG = '#fbf7ef';

export function StorefrontPromoBar() {
  return (
    <div
      className="border-b border-stone-200"
      style={{ background: STOREFRONT_GREEN }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium tracking-wide text-white sm:px-6 lg:px-8">
        <SparklesIcon className="h-4 w-4 shrink-0 text-amber-200" />
        <span>
          Take <strong>15% off</strong> your first order with code{' '}
          <span className="rounded bg-white/15 px-1.5 py-0.5 font-mono">
            WELCOME15
          </span>
        </span>
      </div>
    </div>
  );
}

function MenuLinks({ items, className }) {
  if (!items?.length) return null;

  return (
    <div className={className}>
      {items.map((item) => {
        const linkProps = item.openInNew
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {};
        const isExternal = item.url?.startsWith('http');
        if (isExternal) {
          return (
            <a
              key={item.id}
              href={item.url}
              className="hover:text-stone-900"
              {...linkProps}
            >
              {item.label}
            </a>
          );
        }
        return (
          <Link
            key={item.id}
            to={item.url || '/'}
            className="hover:text-stone-900"
            {...linkProps}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function StorefrontSubHeader({ items = [] }) {
  return (
    <div className="border-b border-stone-200 bg-[#fbf7ef]">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-5 sm:flex-row sm:px-6 lg:px-8">
        <Form
          method="get"
          action="/search"
          className="flex flex-1 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 focus-within:border-stone-700 focus-within:ring-2 focus-within:ring-stone-200 sm:max-w-md"
        >
          <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-stone-400" />
          <input
            type="search"
            name="q"
            placeholder="Search the shop"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
          />
        </Form>
        <MenuLinks
          items={items}
          className="flex items-center gap-5 text-xs tracking-wide text-stone-600 uppercase"
        />
      </div>
    </div>
  );
}

function StorefrontMainNav({
  locale,
  currency,
  availableLocales,
  availableCurrencies,
  menuItems = [],
}) {
  const t = useT();

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200 bg-[#fbf7ef]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="font-serif text-xl tracking-tight text-stone-900 transition-colors hover:opacity-80"
        >
          bermooda
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {menuItems.length > 0 ? (
            menuItems.map((item) => (
              <Link
                key={item.id}
                to={item.url || '/'}
                className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
                {...(item.openInNew
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {item.label}
              </Link>
            ))
          ) : (
            <Link
              to="/"
              className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
            >
              {t('nav.home')}
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-stone-700">
            <LocaleSwitcher
              currentLocale={locale}
              availableLocales={availableLocales}
            />
            <CurrencySwitcher
              currentCurrency={currency}
              availableCurrencies={availableCurrencies}
            />
          </div>
          <Link
            to="/cart"
            aria-label={t('nav.cart')}
            className="rounded-full p-2 text-stone-600 transition-colors hover:bg-stone-200/60 hover:text-stone-900"
          >
            <ShoppingCartIcon className="h-6 w-6" />
          </Link>
          <Link
            to="/account"
            className="hidden text-sm font-medium text-stone-600 transition-colors hover:text-stone-900 sm:inline"
          >
            {t('nav.account')}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function StorefrontFooter({ items = [] }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-center text-sm text-stone-500">
            &copy; {year} bermooda. All rights reserved.
          </p>
          {items.length > 0 ? (
            <MenuLinks
              items={items}
              className="flex gap-6 text-xs font-semibold tracking-wide text-stone-600 uppercase"
            />
          ) : (
            <div className="flex gap-6 text-xs font-semibold tracking-wide text-stone-600 uppercase">
              <Link to="/" className="hover:text-stone-900">
                Shipping
              </Link>
              <Link to="/" className="hover:text-stone-900">
                Returns
              </Link>
              <Link to="/account/login" className="hover:text-stone-900">
                Account
              </Link>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

/**
 * Shared storefront frame: promo bar, search strip, main nav, scrollable main, footer.
 * Uses loader data from routes/storefront/_layout.jsx when available.
 */
export default function StorefrontShell({ children }) {
  const layoutData = useRouteLoaderData('routes/storefront/_layout');
  const locale = layoutData?.locale ?? 'en';
  const currency = layoutData?.currency ?? 'USD';
  const availableLocales = layoutData?.availableLocales ?? ['en'];
  const availableCurrencies = layoutData?.availableCurrencies ?? ['USD'];
  const menus = layoutData?.menus ?? { main: [], footer: [], subHeader: [] };

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf7ef] font-sans text-stone-800 antialiased">
      <StorefrontPromoBar />
      <StorefrontSubHeader items={menus.subHeader} />
      <StorefrontMainNav
        locale={locale}
        currency={currency}
        availableLocales={availableLocales}
        availableCurrencies={availableCurrencies}
        menuItems={menus.main}
      />
      <main className="flex-1">{children}</main>
      <StorefrontFooter items={menus.footer} />
    </div>
  );
}
