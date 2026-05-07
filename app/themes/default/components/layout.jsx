import { ShoppingCartIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router';

import { useT } from '#/core/i18n/index';

export default function Layout({
  children,
  localeSwitcher,
  currencySwitcher,
  customer,
}) {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link
              to="/"
              className="text-xl font-bold tracking-tight text-gray-900 transition-colors hover:text-gray-600 dark:text-white dark:hover:text-gray-300"
            >
              bermooda
            </Link>

            {/* Nav */}
            <nav className="hidden items-center gap-6 md:flex">
              <Link
                to="/"
                className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                {t('nav.home')}
              </Link>
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Locale / Currency switchers */}
              {localeSwitcher && (
                <div className="flex items-center">{localeSwitcher}</div>
              )}
              {currencySwitcher && (
                <div className="flex items-center">{currencySwitcher}</div>
              )}

              {/* Cart */}
              <Link
                to="/cart"
                aria-label={t('nav.cart')}
                className="relative p-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                <ShoppingCartIcon className="h-6 w-6" />
              </Link>

              {/* Account / Sign In */}
              {customer ? (
                <Link
                  to="/account"
                  className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  {t('nav.account')}
                </Link>
              ) : (
                <Link
                  to="/account/login"
                  className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  {t('nav.signIn')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            &copy; {year} bermooda. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
