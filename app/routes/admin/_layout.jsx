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
  GlobeAltIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SunIcon,
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
import useCommandPalette, {
  getCommandPaletteShortcutLabel,
} from '#/hooks/use-command-palette';
import useTheme from '#/hooks/use-theme';
import CommandPalette from '#/components/admin/command-palette';
import { NAV_GROUPS } from '#/components/admin/nav-config';
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
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-surface-2 text-text'
          : 'text-text-muted hover:bg-surface-2/60 hover:text-text'
      }`}
    >
      <item.Icon
        className={`h-5 w-5 flex-shrink-0 ${
          active ? 'text-accent' : 'text-text-muted/80 group-hover:text-text'
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
      <MenuButton className="text-text data-active:bg-surface-2 data-hover:bg-surface-2 flex w-full cursor-default items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium">
        <span className="flex min-w-0 items-center gap-3">
          <span className="border-border bg-surface-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
            <UserIconSolid className="text-text-muted h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="text-text block truncate text-sm font-medium">
              {user.name.split(' ')[0]}
            </span>
            <span className="text-text-muted block truncate text-xs font-normal">
              {user.email}
            </span>
          </span>
        </span>
      </MenuButton>

      <MenuItems
        transition
        anchor="top end"
        className="border-border bg-surface isolate z-30 w-max min-w-56 overflow-y-auto rounded-xl border p-1 shadow-lg transition [--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(1)] focus:outline-hidden data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0 data-[anchor~=end]:[--anchor-offset:6px]"
      >
        {/* Theme Toggle */}
        <MenuItem>
          <button
            type="button"
            onClick={toggleTheme}
            className="text-text data-focus:bg-accent data-focus:text-accent-fg group col-span-full grid w-full cursor-default grid-cols-[auto_1fr] items-center rounded-lg px-3 py-1.5 text-left text-sm focus:outline-hidden"
          >
            {isDark ? (
              <SunIcon className="text-text-muted group-data-focus:text-accent-fg mr-2 h-4 w-4" />
            ) : (
              <MoonIcon className="text-text-muted group-data-focus:text-accent-fg mr-2 h-4 w-4" />
            )}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>
        </MenuItem>

        <hr className="border-border -mx-[3px] my-1 block" />

        {/* View storefront */}
        <MenuItem>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text data-focus:bg-accent data-focus:text-accent-fg group col-span-full grid w-full cursor-default grid-cols-[auto_1fr] items-center rounded-lg px-3 py-1.5 text-left text-sm focus:outline-hidden"
          >
            <GlobeAltIcon className="text-text-muted group-data-focus:text-accent-fg mr-2 h-4 w-4" />
            View storefront
          </a>
        </MenuItem>

        <hr className="border-border -mx-[3px] my-1 block" />

        {/* Logout */}
        <MenuItem>
          <Link
            to="/admin/logout"
            className="text-text data-focus:bg-accent data-focus:text-accent-fg group col-span-full grid w-full cursor-default grid-cols-[auto_1fr] items-center rounded-lg px-3 py-1.5 text-left text-sm focus:outline-hidden"
          >
            <ArrowRightStartOnRectangleIcon className="text-text-muted group-data-focus:text-accent-fg mr-2 h-4 w-4" />
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
      <div className="border-border flex items-center justify-between border-b px-4 py-4">
        <Link
          to="/admin/dashboard"
          className="text-text flex items-center gap-2 px-1"
          onClick={onClose}
        >
          <Logo alt="Admin" className="-m-1 h-7 w-auto" />
          <span className="text-base font-bold">Admin</span>
        </Link>

        <button
          type="button"
          className="text-text-muted hover:text-text md:hidden"
          onClick={onClose}
        >
          <span className="sr-only">Close sidebar</span>
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Nav */}
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-6 px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="text-text-muted px-3 pb-1 text-xs font-semibold tracking-wider uppercase">
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavLink key={item.name} item={item} onClick={onClose} />
              ))}
            </div>
          ))}
        </nav>

        {/* User menu at the bottom */}
        <div className="border-border mt-auto border-t p-3">
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
    <div className="border-border bg-surface fixed hidden h-full w-64 flex-col border-r md:flex">
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
          className="fixed inset-0 z-10 bg-black/40 transition duration-300 data-closed:opacity-0"
          onClick={onClose}
        />
      </TransitionChild>

      {/* Drawer */}
      <TransitionChild>
        <div className="fixed inset-y-0 left-0 z-20 w-72 p-2 transition duration-300 data-closed:-translate-x-full">
          <div className="border-border bg-surface flex h-full flex-col overflow-hidden rounded-xl border shadow-lg">
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
        className="text-text-muted hover:bg-surface-2 hover:text-text rounded-md p-2"
        aria-label={t('admin.topbar.switchLocale')}
      >
        <GlobeAltIcon className="h-5 w-5" aria-hidden="true" />
      </MenuButton>
      <MenuItems
        transition
        anchor="bottom end"
        className="border-border bg-surface isolate z-30 w-max min-w-40 overflow-y-auto rounded-xl border p-1 shadow-lg transition [--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(1)] focus:outline-hidden data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0"
      >
        {availableLocales.map((l) => (
          <MenuItem key={l}>
            <fetcher.Form method="post" action="/api/set-locale">
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="locale" value={l} />
              <button
                type="submit"
                className="text-text data-focus:bg-accent data-focus:text-accent-fg group grid w-full cursor-default grid-cols-[auto_1fr] items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm focus:outline-hidden"
                aria-current={l === locale ? 'true' : undefined}
              >
                <span className="text-text-muted group-data-focus:text-accent-fg text-xs font-semibold uppercase">
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
function Topbar({ onMenuOpen, onOpenCommandPalette }) {
  const { isDark, toggleTheme } = useTheme();
  const shortcutLabel = getCommandPaletteShortcutLabel();

  return (
    <header className="border-border bg-surface sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4 md:px-6">
      {/* Hamburger — mobile only */}
      <button
        type="button"
        className="text-text-muted hover:bg-surface-2 hover:text-text -ml-1 rounded-md p-2 focus:outline-none md:hidden"
        onClick={onMenuOpen}
        aria-label="Open sidebar"
      >
        <Bars3Icon className="h-6 w-6" />
      </button>

      {/* Command palette trigger */}
      <div className="flex flex-1 items-center">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="bg-surface-2 text-text-muted border-border hover:border-accent/40 focus:border-accent focus:ring-accent/40 relative flex w-full max-w-md items-center rounded-md border py-1.5 pr-3 pl-9 text-left text-sm transition-colors focus:ring-2 focus:outline-none"
          aria-label={`Open command palette (${shortcutLabel})`}
        >
          <MagnifyingGlassIcon
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <span className="truncate">Search admin...</span>
          <kbd className="border-border bg-surface text-text-muted pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline">
            {shortcutLabel}
          </kbd>
        </button>
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-1">
        <LocaleMenu />

        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="text-text-muted hover:bg-surface-2 hover:text-text rounded-md p-2"
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
  const { open, setOpen, openPalette } = useCommandPalette();

  function t(key, params) {
    return translate(key, params, messages);
  }

  return (
    <I18nContext.Provider value={{ t }}>
      <div className="bg-bg text-text flex h-full min-h-screen">
        {/* Sidebars */}
        <DesktopSidebar />
        <MobileSidebar
          isOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        {/* Main content area */}
        <div className="flex flex-1 flex-col md:ml-64">
          <Topbar
            onMenuOpen={() => setMobileOpen(true)}
            onOpenCommandPalette={openPalette}
          />
          <CommandPalette open={open} onOpenChange={setOpen} />

          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </I18nContext.Provider>
  );
}
