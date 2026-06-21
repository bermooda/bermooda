import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  DocumentChartBarIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  CubeIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PaintBrushIcon,
  PuzzlePieceIcon,
  ReceiptPercentIcon,
  ShoppingBagIcon,
  StarIcon,
  SunIcon,
  TagIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { UserIcon as UserIconSolid } from '@heroicons/react/24/solid';
import { useState } from 'react';
import {
  Link,
  Outlet,
  useFetcher,
  useLoaderData,
  useLocation,
} from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';
import useTheme from '#/hooks/use-theme';
import Logo from '#/components/ui/logo';

import { I18nContext } from '#/core/i18n/context';
import { translate, useT } from '#/core/i18n/index';
import { getRequestLocale, loadMessages } from '#/core/i18n/index.server';

const ADMIN_AVAILABLE_LOCALES = ['en', 'de', 'fr'];

/**
 * Loader — verifies admin session; redirects to /admin/login on failure.
 */
export async function loader({ request }) {
  const session = await authenticate(request);
  const locale = await getRequestLocale(request);
  const messages = await loadMessages(locale);
  return {
    user: session.user,
    locale,
    availableLocales: ADMIN_AVAILABLE_LOCALES,
    messages,
  };
}

// ------------------------------------------------------------------
// Nav items
// ------------------------------------------------------------------

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/admin/dashboard', Icon: ChartBarIcon },
  { name: 'Reports', href: '/admin/reports', Icon: DocumentChartBarIcon },
  { name: 'Products', href: '/admin/products', Icon: CubeIcon },
  { name: 'Categories', href: '/admin/categories', Icon: TagIcon },
  { name: 'Pages', href: '/admin/pages', Icon: DocumentTextIcon },
  { name: 'Menus', href: '/admin/menus', Icon: Bars3Icon },
  { name: 'Reviews', href: '/admin/reviews', Icon: StarIcon },
  { name: 'Orders', href: '/admin/orders', Icon: ShoppingBagIcon },
  { name: 'Customers', href: '/admin/customers', Icon: UserGroupIcon },
  {
    name: 'Customer Groups',
    href: '/admin/customer-groups',
    Icon: UserGroupIcon,
  },
  { name: 'Price Lists', href: '/admin/price-lists', Icon: TagIcon },
  { name: 'Inventory', href: '/admin/inventory', Icon: CubeIcon },
  { name: 'Gift Cards', href: '/admin/gift-cards', Icon: ReceiptPercentIcon },
  { name: 'Loyalty', href: '/admin/loyalty', Icon: StarIcon },
  { name: 'Marketing', href: '/admin/marketing', Icon: ChartBarIcon },
  { name: 'Channels', href: '/admin/channels', Icon: GlobeAltIcon },
  { name: 'Discounts', href: '/admin/discounts', Icon: ReceiptPercentIcon },
  { name: 'Themes', href: '/admin/themes', Icon: PaintBrushIcon },
  { name: 'Plugins', href: '/admin/plugins', Icon: PuzzlePieceIcon },
  { name: 'API', href: '/admin/api-settings', Icon: CodeBracketIcon },
  {
    name: 'Audit Log',
    href: '/admin/audit-log',
    Icon: ClipboardDocumentListIcon,
  },
  { name: 'Settings', href: '/admin/settings', Icon: Cog6ToothIcon },
];

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

/**
 * Returns true when the current path matches or starts with the nav item href.
 *
 * @param {string} pathname - current location pathname
 * @param {string} href - nav item href
 * @returns {boolean}
 */
function isActive(pathname, href) {
  if (href === '/admin/dashboard') return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * Admin nav link
 */
function NavLink({ item, onClick }) {
  const location = useLocation();
  const active = isActive(location.pathname, item.href);

  return (
    <Link
      to={item.href}
      onClick={onClick}
      className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
        active
          ? 'dark:bg-accent-violet/20 dark:ring-accent-violet/30 bg-gray-200 text-gray-900 md:bg-white md:ring md:ring-gray-200 dark:text-white'
          : 'dark:text-dark-400 dark:hover:bg-dark-700/50 dark:hover:text-dark-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <item.Icon
        className={`mr-3 h-5 w-5 flex-shrink-0 ${
          active
            ? 'dark:text-accent-fuchsia text-gray-700'
            : 'dark:text-dark-500 dark:group-hover:text-dark-400 text-gray-500 group-hover:text-gray-600'
        }`}
        aria-hidden="true"
      />
      {item.name}
    </Link>
  );
}

/**
 * Admin user menu (avatar + dropdown)
 */
function AdminUserMenu() {
  const { user } = useLoaderData();
  const { isDark, toggleTheme } = useTheme();

  return (
    <Menu>
      <MenuButton className="dark:text-dark-300 dark:data-active:bg-dark-700/50 dark:data-hover:bg-dark-700/50 flex w-full cursor-default items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-zinc-950 data-active:bg-zinc-950/5 data-hover:bg-zinc-950/5">
        <span className="flex min-w-0 items-center gap-3">
          <span className="dark:outline-dark-600 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 outline -outline-offset-1 outline-black/10 dark:bg-zinc-800">
            <UserIconSolid className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">
              {user.name.split(' ')[0]}
            </span>
            <span className="dark:text-dark-500 block truncate text-xs font-normal text-zinc-500">
              {user.email}
            </span>
          </span>
        </span>
      </MenuButton>

      <MenuItems
        transition
        anchor="top end"
        className="dark-glass dark:ring-dark-700/50 isolate z-30 w-max min-w-56 overflow-y-auto rounded-xl bg-white/75 p-1 shadow-lg ring-1 ring-zinc-950/10 outline outline-transparent backdrop-blur-xl transition [--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(1)] focus:outline-hidden data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0 data-[anchor~=end]:[--anchor-offset:6px]"
      >
        {/* Theme Toggle */}
        <MenuItem>
          <button
            type="button"
            onClick={toggleTheme}
            className="group col-span-full grid w-full cursor-default grid-cols-[auto_1fr] items-center rounded-lg px-3 py-1.5 text-left text-sm text-zinc-950 focus:outline-hidden data-focus:bg-blue-500 data-focus:text-white dark:text-white"
          >
            {isDark ? (
              <SunIcon className="mr-2 h-4 w-4 text-zinc-500 data-focus:text-white" />
            ) : (
              <MoonIcon className="mr-2 h-4 w-4 text-zinc-500 data-focus:text-white" />
            )}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>
        </MenuItem>

        <hr className="-mx-[3px] my-1 block border-zinc-200 dark:border-white/10" />

        {/* View storefront */}
        <MenuItem>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-full grid w-full cursor-default grid-cols-[auto_1fr] items-center rounded-lg px-3 py-1.5 text-left text-sm text-zinc-950 focus:outline-hidden data-focus:bg-blue-500 data-focus:text-white dark:text-white"
          >
            <GlobeAltIcon className="mr-2 h-4 w-4 text-zinc-500" />
            View storefront
          </a>
        </MenuItem>

        <hr className="-mx-[3px] my-1 block border-zinc-200 dark:border-white/10" />

        {/* Logout */}
        <MenuItem>
          <Link
            to="/admin/logout"
            className="col-span-full grid w-full cursor-default grid-cols-[auto_1fr] items-center rounded-lg px-3 py-1.5 text-left text-sm text-zinc-950 focus:outline-hidden data-focus:bg-blue-500 data-focus:text-white dark:text-white"
          >
            <ArrowRightStartOnRectangleIcon className="mr-2 h-4 w-4 text-zinc-500" />
            Logout
          </Link>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}

/**
 * Sidebar content
 */
function SidebarContent({ onClose }) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="dark:border-dark-700/50 flex items-center justify-between border-b border-gray-100 px-4 py-4 md:border-gray-200">
        <Link
          to="/admin/dashboard"
          className="flex items-center gap-2 px-1 text-slate-800 dark:text-white"
          onClick={onClose}
        >
          <Logo alt="Admin" className="-m-1 h-7 w-auto" />
          <span className="text-base font-bold">Admin</span>
        </Link>

        <button
          type="button"
          className="dark:text-dark-500 dark:hover:text-dark-400 text-gray-500 hover:text-gray-600 md:hidden"
          onClick={onClose}
        >
          <span className="sr-only">Close sidebar</span>
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Nav */}
      <div className="flex h-full flex-col overflow-y-auto">
        <nav className="space-y-1 px-2 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.name} item={item} onClick={onClose} />
          ))}
        </nav>

        {/* User menu at the bottom */}
        <div className="dark:border-dark-700/50 mt-auto border-t border-zinc-950/5 p-4">
          <AdminUserMenu />
        </div>
      </div>
    </div>
  );
}

/**
 * Desktop sidebar (fixed, always visible on md+)
 */
function DesktopSidebar() {
  return (
    <div className="dark-gradient-subtle dark:ring-dark-700/50 fixed hidden h-full w-64 flex-col bg-white shadow-xs ring-1 ring-zinc-950/5 md:flex">
      <SidebarContent onClose={() => {}} />
    </div>
  );
}

/**
 * Mobile sidebar (slide-in drawer)
 */
function MobileSidebar({ isOpen, onClose }) {
  return (
    <Transition show={isOpen}>
      {/* Backdrop */}
      <TransitionChild>
        <div
          className="fixed inset-0 z-10 bg-black/30 transition duration-300 data-closed:opacity-0"
          onClick={onClose}
        />
      </TransitionChild>

      {/* Drawer */}
      <TransitionChild>
        <div className="fixed inset-y-0 left-0 z-20 w-72 p-2 transition duration-300 data-closed:-translate-x-full">
          <div className="dark-gradient-subtle dark:ring-dark-700/50 flex h-full flex-col rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/5">
            <SidebarContent onClose={onClose} />
          </div>
        </div>
      </TransitionChild>
    </Transition>
  );
}

const LOCALE_LABELS = { en: 'English', de: 'Deutsch', fr: 'Français' };

/**
 * Locale switcher — POSTs to /api/set-locale, persists via cookie, revalidates without nav.
 */
function LocaleMenu() {
  const { locale, availableLocales } = useLoaderData();
  const fetcher = useFetcher();
  const location = useLocation();
  const t = useT();

  if (!availableLocales || availableLocales.length <= 1) return null;

  const returnTo = location.pathname + location.search;

  return (
    <Menu>
      <MenuButton
        className="dark:text-dark-400 dark:hover:bg-dark-700/50 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:text-gray-200"
        aria-label={t('admin.topbar.switchLocale')}
      >
        <GlobeAltIcon className="h-5 w-5" aria-hidden="true" />
      </MenuButton>
      <MenuItems
        transition
        anchor="bottom end"
        className="dark-glass dark:ring-dark-700/50 isolate z-30 w-max min-w-40 overflow-y-auto rounded-xl bg-white/75 p-1 shadow-lg ring-1 ring-zinc-950/10 outline outline-transparent backdrop-blur-xl transition [--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(1)] focus:outline-hidden data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0"
      >
        {availableLocales.map((l) => (
          <MenuItem key={l}>
            <fetcher.Form method="post" action="/api/set-locale">
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="locale" value={l} />
              <button
                type="submit"
                className="grid w-full cursor-default grid-cols-[auto_1fr] items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-zinc-950 focus:outline-hidden data-focus:bg-blue-500 data-focus:text-white dark:text-white"
                aria-current={l === locale ? 'true' : undefined}
              >
                <span className="text-xs font-semibold text-zinc-500 uppercase data-focus:text-white dark:text-zinc-400">
                  {l}
                </span>
                <span>
                  {LOCALE_LABELS[l] ?? l}
                  {l === locale ? ' ✓' : ''}
                </span>
              </button>
            </fetcher.Form>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

/**
 * Top bar with hamburger menu, search, and user actions
 */
function Topbar({ onMenuOpen }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="dark:border-dark-700/50 dark:bg-dark-900/80 sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-gray-200 bg-white/80 px-4 backdrop-blur-sm md:px-6">
      {/* Hamburger — mobile only */}
      <button
        type="button"
        className="dark:text-dark-400 dark:hover:text-dark-300 -ml-1 rounded-md p-2 text-gray-500 hover:text-gray-700 focus:outline-none md:hidden"
        onClick={onMenuOpen}
        aria-label="Open sidebar"
      >
        <Bars3Icon className="h-6 w-6" />
      </button>

      {/* Search */}
      <div className="flex flex-1 items-center">
        <div className="relative max-w-md flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search..."
            className="dark:bg-dark-800 dark:text-dark-300 dark:outline-dark-600 dark:placeholder:text-dark-500 w-full rounded-md bg-gray-50 py-1.5 pr-3 pl-9 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:bg-zinc-800"
          />
        </div>
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-2">
        <LocaleMenu />

        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="dark:text-dark-400 dark:hover:bg-dark-700/50 dark:hover:text-accent-fuchsia rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <SunIcon className="h-5 w-5" aria-hidden="true" />
          ) : (
            <MoonIcon className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------
// Main layout
// ------------------------------------------------------------------

export const handle = {
  htmlClass: 'h-full',
  bodyClass: 'h-full',
};

/**
 * Authenticated Admin Layout
 * Renders sidebar + topbar and an Outlet for nested routes.
 *
 * @returns {React.ReactElement}
 */
export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { messages } = useLoaderData();

  function t(key, params) {
    return translate(key, params, messages);
  }

  return (
    <I18nContext.Provider value={{ t }}>
      <div className="dark:bg-dark-950 flex h-full min-h-screen bg-gray-50">
        {/* Sidebars */}
        <DesktopSidebar />
        <MobileSidebar
          isOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        {/* Main content area */}
        <div className="flex flex-1 flex-col md:ml-64">
          <Topbar onMenuOpen={() => setMobileOpen(true)} />

          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </I18nContext.Provider>
  );
}
