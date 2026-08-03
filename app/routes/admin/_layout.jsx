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
  ChevronDownIcon,
  ChevronUpIcon,
  ComputerDesktopIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SunIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { UserIcon as UserIconSolid } from '@heroicons/react/24/solid';
import { useState } from 'react';
import { Link, Outlet, useLoaderData, useLocation } from 'react-router';

import { PLATFORM_NAME } from '#/libs/config';
import { authenticate } from '#/libs/auth/admin/index.server';
import { ADMIN_AVAILABLE_LOCALES, translate, useT } from '#/core/i18n';
import { I18nContext } from '#/core/i18n/context';
import { getRequestLocale, loadMessages } from '#/core/i18n/index.server';
import useCommandPalette, {
  getCommandPaletteShortcutLabel,
} from '#/hooks/use-command-palette';
import useTheme from '#/hooks/use-theme';
import CommandPalette from '#/components/admin/command-palette';
import { NAV_GROUPS } from '#/components/admin/nav-config';
import Logo from '#/components/ui/logo';

/**
 * Loader — verifies admin session; redirects to /admin/login on failure.
 *
 * @param {{ request: Request }} args
 * @returns {Promise<{
 *   user: object,
 *   locale: string,
 *   availableLocales: string[],
 *   messages: Record<string, string>,
 * }>}
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
 * Returns true when any item in the nav group matches the current path.
 *
 * @param {string} pathname
 * @param {{ label: string, items: Array<{ href: string }> }} group
 * @returns {boolean}
 */
function isGroupActive(pathname, group) {
  return group.items.some((item) => isActive(pathname, item.href));
}

/**
 * Collapsible admin nav group.
 *
 * @param {Object} props
 * @param {{ label: string, Icon: React.ComponentType<{ className?: string, 'aria-hidden'?: boolean | 'true' | 'false' }>, items: Array<{ name: string, href: string }> }} props.group
 * @param {() => void} props.onClose
 * @param {boolean} props.isExpanded
 * @param {() => void} props.onToggle
 * @returns {React.ReactElement}
 */
function NavGroup({ group, onClose, isExpanded, onToggle }) {
  const t = useT();
  const panelId = `nav-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="space-y-1">
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="text-text-muted hover:text-text group flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-xs font-semibold tracking-wider uppercase transition-colors"
      >
        <span className="flex min-w-0 items-center gap-3">
          <group.Icon
            className="text-text-muted/80 group-hover:text-text h-5 w-5 shrink-0"
            aria-hidden="true"
          />
          <span>{t(group.label)}</span>
        </span>
        {isExpanded ? (
          <ChevronUpIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
      </button>
      {isExpanded ? (
        <div id={panelId} role="region" aria-labelledby={`${panelId}-trigger`}>
          {group.items.map((item) => (
            <NavLink key={item.name} item={item} onClick={onClose} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Admin nav link
 *
 * @param {Object} props
 * @param {{ name: string, href: string }} props.item
 * @param {() => void} [props.onClick]
 * @returns {React.ReactElement}
 */
function NavLink({ item, onClick }) {
  const t = useT();
  const location = useLocation();
  const active = isActive(location.pathname, item.href);

  return (
    <Link
      to={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`block rounded-md py-2 pr-3 pl-11 text-sm font-medium transition-colors ${
        active
          ? 'bg-surface-2 text-text'
          : 'text-text-muted hover:bg-surface-2/60 hover:text-text'
      }`}
    >
      {t(item.name)}
    </Link>
  );
}

/**
 * Admin user menu (avatar + dropdown)
 *
 * @returns {React.ReactElement}
 */
function AdminUserMenu() {
  const t = useT();
  const { user } = useLoaderData();
  const { isDark, toggleTheme } = useTheme();

  return (
    <Menu>
      <MenuButton className="text-text data-active:bg-surface-2 data-hover:bg-surface-2 flex w-full cursor-default items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium">
        <span className="flex min-w-0 flex-1 items-center gap-3">
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
        <ChevronUpIcon
          className="text-text-muted h-4 w-4 shrink-0"
          aria-hidden="true"
        />
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
            {isDark ? t('admin.chrome.lightMode') : t('admin.chrome.darkMode')}
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
            <ComputerDesktopIcon className="text-text-muted group-data-focus:text-accent-fg mr-2 h-4 w-4" />
            {t('admin.chrome.viewStorefront')}
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
            {t('admin.chrome.logout')}
          </Link>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}

/**
 * Sidebar content
 *
 * @param {Object} props
 * @param {() => void} props.onClose
 * @param {() => void} props.onOpenCommandPalette
 * @returns {React.ReactElement}
 */
function SidebarContent({ onClose, onOpenCommandPalette }) {
  const t = useT();
  const location = useLocation();
  const shortcutLabel = getCommandPaletteShortcutLabel();
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  function handleNavScroll(event) {
    setHeaderScrolled(event.currentTarget.scrollTop > 0);
  }

  function toggleGroup(label) {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="relative flex items-center justify-between gap-2 px-4 py-4">
        <Link
          to="/admin/dashboard"
          className="text-text flex min-w-0 items-center gap-2 px-1"
          onClick={onClose}
        >
          <Logo alt="Admin" className="-m-1 h-7 w-auto shrink-0" />
          <span className="truncate text-base font-bold">{PLATFORM_NAME}</span>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="text-text-muted hover:bg-surface-2 hover:text-text rounded-md p-2"
            aria-label={t('admin.chrome.openCommandPalette', {
              shortcut: shortcutLabel,
            })}
          >
            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="text-text-muted hover:text-text md:hidden"
            onClick={onClose}
          >
            <span className="sr-only">{t('admin.chrome.closeSidebar')}</span>
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div
          aria-hidden="true"
          className={`bg-border/50 pointer-events-none absolute inset-x-0 bottom-0 h-px transition-opacity duration-200 ${
            headerScrolled ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      {/* Nav */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={handleNavScroll}
      >
        <nav className="space-y-4 px-3 py-4">
          {NAV_GROUPS.map((group) => {
            const active = isGroupActive(location.pathname, group);
            const isExpanded = active || expandedGroups.has(group.label);

            return (
              <NavGroup
                key={group.label}
                group={group}
                onClose={onClose}
                isExpanded={isExpanded}
                onToggle={() => toggleGroup(group.label)}
              />
            );
          })}
        </nav>
      </div>

      {/* User menu pinned to the bottom */}
      <div className="border-border/50 bg-surface shrink-0 border-t p-3">
        <AdminUserMenu />
      </div>
    </div>
  );
}

/**
 * Desktop sidebar (fixed, always visible on md+)
 */
function DesktopSidebar({ onOpenCommandPalette }) {
  return (
    <div className="bg-surface fixed hidden h-full w-64 flex-col md:flex">
      <SidebarContent
        onClose={() => {}}
        onOpenCommandPalette={onOpenCommandPalette}
      />
    </div>
  );
}

/**
 * Mobile sidebar (slide-in drawer)
 */
function MobileSidebar({ isOpen, onClose, onOpenCommandPalette }) {
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
            <SidebarContent
              onClose={onClose}
              onOpenCommandPalette={onOpenCommandPalette}
            />
          </div>
        </div>
      </TransitionChild>
    </Transition>
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
        <DesktopSidebar onOpenCommandPalette={openPalette} />
        <MobileSidebar
          isOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          onOpenCommandPalette={openPalette}
        />

        {/* Main content area */}
        <div className="flex flex-1 flex-col md:ml-64">
          <CommandPalette open={open} onOpenChange={setOpen} />

          {/*
            Padding lives on the inner shell (not the scrollport) so
            position:sticky top-0 headers can sit flush at the top of main.
          */}
          <main className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
              <button
                type="button"
                className="text-text-muted hover:bg-surface-2 hover:text-text mb-2 -ml-1 rounded-md p-2 md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label={t('admin.chrome.openSidebar')}
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </I18nContext.Provider>
  );
}
