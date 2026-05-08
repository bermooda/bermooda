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
  ChartBarIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
  MoonIcon,
  QuestionMarkCircleIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import { UserIcon as UserIconSolid } from '@heroicons/react/24/solid';
import { Link, useLoaderData, useLocation } from 'react-router';

import useSidebar from '#/hooks/use-sidebar';
import useTheme from '#/hooks/use-theme';
import Logo from '#/components/ui/logo';

const NAV_ITEMS = [
  { name: 'Account', href: '/account', Icon: ChartBarIcon },
  { name: 'Settings', href: '/settings', Icon: Cog6ToothIcon },
];

const BOTTOM_NAV_ITEMS = [
  { name: 'Support', href: '/support', Icon: QuestionMarkCircleIcon },
];

// These should be fetched from the database
const announcements = [
  // { name: 'Viking People', href: '/events/viking-people' },
  // { name: 'Six Fingers — DJ Set', href: '/events/six-fingers' },
  // { name: 'We All Look The Same', href: '/events/we-all-look-the-same' },
];

/**
 * Sidebar User Menu
 *
 * @returns {React.ReactNode} The rendered component
 */
function SidebarUserMenu() {
  const data = useLoaderData();
  const { isDark, toggleTheme } = useTheme();

  return (
    <Menu>
      <MenuButton className="dark:text-dark-300 dark:data-active:bg-dark-700/50 dark:data-hover:bg-dark-700/50 dark:*:data-[slot=icon]:fill-dark-500 flex w-full cursor-default items-center gap-3 rounded-lg px-2 py-2.5 text-left text-base/6 font-medium text-zinc-950 data-active:bg-zinc-950/5 data-hover:bg-zinc-950/5 *:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-7 *:data-[slot=avatar]:[--ring-opacity:10%] *:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:fill-zinc-500 *:last:data-[slot=icon]:ml-auto *:last:data-[slot=icon]:size-5 data-active:*:data-[slot=icon]:fill-zinc-950 data-current:*:data-[slot=icon]:fill-zinc-950 data-hover:*:data-[slot=icon]:fill-zinc-950 sm:py-2 sm:text-sm/5 sm:*:data-[slot=avatar]:size-6 sm:*:data-[slot=icon]:size-5 sm:*:last:data-[slot=icon]:size-4 dark:data-active:*:data-[slot=icon]:fill-white dark:data-current:*:data-[slot=icon]:fill-white dark:data-hover:*:data-[slot=icon]:fill-white">
        <span
          className="absolute top-1/2 left-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 pointer-fine:hidden"
          aria-hidden="true"
        ></span>
        <span className="flex min-w-0 items-center gap-3">
          <span
            data-slot="avatar"
            className="dark:outline-dark-600 flex size-10 shrink-0 items-center justify-center rounded-(--avatar-radius) align-middle outline -outline-offset-1 outline-black/(--ring-opacity) [--avatar-radius:20%] [--ring-opacity:20%] *:col-start-1 *:row-start-1 *:rounded-(--avatar-radius)"
          >
            <UserIconSolid className="h-8 w-8" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
              {data.user.name.split(' ')[0]}
            </span>
            <span className="dark:text-dark-500 block truncate text-xs/5 font-normal text-zinc-500">
              {data.user.email}
            </span>
          </span>
        </span>
        <span className="ml-auto block text-gray-500 hover:text-gray-600">
          <ChevronUpIcon className="h-5 w-5" />
        </span>
      </MenuButton>

      <MenuItems
        transition
        anchor="top end"
        className="dark-glass dark:ring-dark-700/50 isolate z-30 w-max min-w-64 overflow-y-auto rounded-xl bg-white/75 p-1 shadow-lg ring-1 ring-zinc-950/10 outline outline-transparent backdrop-blur-xl transition [--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(1)] focus:outline-hidden data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0 data-[anchor~=end]:[--anchor-offset:6px] data-[anchor~=start]:[--anchor-offset:-6px] supports-[grid-template-columns:subgrid]:grid supports-[grid-template-columns:subgrid]:grid-cols-[auto_1fr_1.5rem_0.5rem_auto] sm:data-[anchor~=end]:[--anchor-offset:4px] sm:data-[anchor~=start]:[--anchor-offset:-4px] md:min-w-56"
      >
        {/* Theme Toggle */}
        <MenuItem>
          <button
            type="button"
            onClick={toggleTheme}
            className="group col-span-full grid w-full cursor-default grid-cols-[auto_1fr_1.5rem_0.5rem_auto] items-center rounded-lg px-3.5 py-2.5 text-left text-base/6 text-zinc-950 forced-color-adjust-none focus:outline-hidden data-disabled:opacity-50 data-focus:bg-blue-500 data-focus:text-white *:data-[slot=avatar]:mr-2.5 *:data-[slot=avatar]:-ml-1 *:data-[slot=avatar]:size-6 *:data-[slot=icon]:col-start-1 *:data-[slot=icon]:row-start-1 *:data-[slot=icon]:mr-2.5 *:data-[slot=icon]:-ml-0.5 *:data-[slot=icon]:size-5 *:data-[slot=icon]:text-zinc-500 data-focus:*:data-[slot=icon]:text-white supports-[grid-template-columns:subgrid]:grid-cols-subgrid sm:px-3 sm:py-1.5 sm:text-sm/6 sm:*:data-[slot=avatar]:mr-2 sm:*:data-[slot=avatar]:size-5 sm:*:data-[slot=icon]:mr-2 sm:*:data-[slot=icon]:size-4 dark:text-white dark:*:data-[slot=icon]:text-zinc-400 dark:data-focus:*:data-[slot=icon]:text-white forced-colors:text-[CanvasText] forced-colors:data-focus:bg-[Highlight] forced-colors:data-focus:text-[HighlightText] forced-colors:data-focus:*:data-[slot=icon]:text-[HighlightText]"
          >
            {isDark ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
            {isDark ? 'Light Theme' : 'Dark Theme'}
          </button>
        </MenuItem>

        <hr className="col-span-full -mx-[3px] my-2 block border-zinc-200 dark:border-white/10" />

        {/* Logout */}
        <MenuItem>
          <Link
            to="/account/logout"
            className="group dark:text-dark-300 dark:*:data-[slot=icon]:text-dark-500 col-span-full grid cursor-default grid-cols-[auto_1fr_1.5rem_0.5rem_auto] items-center rounded-lg px-3.5 py-2.5 text-left text-base/6 text-zinc-950 forced-color-adjust-none focus:outline-hidden data-disabled:opacity-50 data-focus:bg-blue-500 data-focus:text-white *:data-[slot=avatar]:mr-2.5 *:data-[slot=avatar]:-ml-1 *:data-[slot=avatar]:size-6 *:data-[slot=icon]:col-start-1 *:data-[slot=icon]:row-start-1 *:data-[slot=icon]:mr-2.5 *:data-[slot=icon]:-ml-0.5 *:data-[slot=icon]:size-5 *:data-[slot=icon]:text-zinc-500 data-focus:*:data-[slot=icon]:text-white supports-[grid-template-columns:subgrid]:grid-cols-subgrid sm:px-3 sm:py-1.5 sm:text-sm/6 sm:*:data-[slot=avatar]:mr-2 sm:*:data-[slot=avatar]:size-5 sm:*:data-[slot=icon]:mr-2 sm:*:data-[slot=icon]:size-4 dark:data-focus:*:data-[slot=icon]:text-white forced-colors:text-[CanvasText] forced-colors:data-focus:bg-[Highlight] forced-colors:data-focus:text-[HighlightText] forced-colors:data-focus:*:data-[slot=icon]:text-[HighlightText]"
          >
            <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
            Logout
          </Link>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}

/**
 * Sidebar Header
 *
 * @param {Object} props - The component props
 * @param {() => void} props.onClose - The function to call when the sidebar is closed
 * @returns {React.ReactNode} The rendered component
 */
function SidebarHeader({ onClose }) {
  return (
    <div className="dark:border-dark-700/50 flex items-center justify-between border-b border-gray-100 px-4 py-4 md:border-gray-200">
      <div className="flex items-center">
        <a
          href="/account"
          className="flex items-center gap-2 px-1.5 text-slate-800 dark:text-white"
        >
          <Logo alt="CursorStack Logo" className="-m-1 h-8 w-auto" />
          <h2 className="text-lg font-bold">CursorStack</h2>
        </a>
      </div>

      {/* Close button - always rendered but hidden on desktop */}
      <button
        type="button"
        className="dark:text-dark-500 dark:hover:text-dark-400 text-gray-500 hover:text-gray-600 md:hidden"
        onClick={onClose}
      >
        <span className="sr-only">Close sidebar</span>
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * Sidebar Navigation
 *
 * @param {Object} props - The component props
 * @param {() => void} props.onClose - The function to call when the sidebar is closed
 * @returns {React.ReactNode} The rendered component
 */
function SidebarNavigation({ onClose }) {
  const location = useLocation();

  return (
    <nav className="space-y-1 px-2">
      {NAV_ITEMS.map((item) => (
        <Link
          to={item.href}
          key={item.name}
          onClick={onClose}
          className={`group text-md flex items-center rounded-md px-2 py-2 font-medium md:text-sm ${
            location.pathname === item.href
              ? 'dark:bg-accent-violet/20 dark:ring-accent-violet/30 bg-gray-200 text-gray-900 md:bg-white md:ring md:ring-gray-200 dark:text-white'
              : 'dark:text-dark-400 dark:hover:bg-dark-700/50 dark:hover:text-dark-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900 md:hover:bg-gray-200'
          }`}
        >
          <item.Icon
            className={`mr-3 h-5 w-5 ${
              location.pathname === item.href
                ? 'dark:text-accent-fuchsia text-gray-700'
                : 'dark:text-dark-500 dark:group-hover:text-dark-400 text-gray-500 group-hover:text-gray-600'
            }`}
            aria-hidden="true"
          />
          {item.name}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Sidebar Announcements
 *
 * @returns {React.ReactNode} The rendered component
 */
function SidebarAnnouncements() {
  // TODO: Fetch announcements from the database if needed
  if (announcements?.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 px-2">
      <h3 className="px-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
        Announcements
      </h3>
      <div className="mt-2 space-y-1">
        {announcements.map((event) => (
          <Link
            key={event.name}
            to={event.href}
            className="group text-md dark:text-dark-400 dark:hover:bg-dark-700/50 flex items-center rounded-md px-2 py-2 font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 md:text-sm"
          >
            {event.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Sidebar Bottom Navigation
 *
 * @param {Object} props - The component props
 * @param {() => void} props.onClose - The function to call when the sidebar is closed
 * @returns {React.ReactNode} The rendered component
 */
function SidebarBottomNavigation({ onClose }) {
  const location = useLocation();

  return (
    <nav className="space-y-1">
      {BOTTOM_NAV_ITEMS.map((item) => (
        <Link
          key={item.name}
          to={item.href}
          onClick={onClose}
          className={`group text-md flex items-center rounded-md px-2 py-2 font-medium md:text-sm ${
            location.pathname === item.href
              ? 'dark:bg-accent-violet/20 dark:ring-accent-violet/30 bg-gray-200 text-gray-900 md:bg-white md:ring md:ring-gray-200 dark:text-white'
              : 'dark:text-dark-400 dark:hover:bg-dark-700/50 dark:hover:text-dark-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900 md:hover:bg-gray-200'
          }`}
        >
          <item.Icon
            className={`mr-3 h-5 w-5 ${
              location.pathname === item.href
                ? 'dark:text-accent-fuchsia text-gray-700'
                : 'dark:text-dark-500 dark:group-hover:text-dark-400 text-gray-500 group-hover:text-gray-600'
            }`}
            aria-hidden="true"
          />
          {item.name}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Sidebar Base
 *
 * @param {Object} props - The component props
 * @param {() => void} props.onClose - The function to call when the sidebar is closed
 * @returns {React.ReactNode} The rendered component
 */
function SidebarBase({ onClose }) {
  return (
    <div className="flex h-full flex-col">
      <SidebarHeader onClose={onClose} />

      {/* Sidebar Content */}
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="space-y-1 px-2 py-4">
          <SidebarNavigation onClose={onClose} />
          <SidebarAnnouncements />
        </div>

        {/* Bottom Area */}
        <div className="mt-auto">
          <div className="p-4">
            <SidebarBottomNavigation onClose={onClose} />
          </div>

          {/* User profile */}
          <div className="dark:border-dark-700/50 relative flex flex-col border-t border-zinc-950/5 p-4">
            <SidebarUserMenu />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Sidebar Desktop
 *
 * @returns {React.ReactNode} The rendered component
 */
export function SidebarDesktop() {
  return (
    <div className="fixed hidden h-full w-64 flex-col md:flex">
      <SidebarBase onClose={() => {}} />
    </div>
  );
}

/**
 * Sidebar Mobile
 *
 * @returns {React.ReactNode} The rendered component
 */
export function SidebarMobile() {
  const { isOpen, closeSidebar } = useSidebar();

  return (
    <Transition show={isOpen}>
      {/* Backdrop */}
      <TransitionChild>
        <div
          className="fixed inset-0 z-10 bg-black/30 transition duration-300 data-closed:opacity-0"
          onClick={closeSidebar}
        />
      </TransitionChild>

      {/* Slide-in sidebar */}
      <TransitionChild>
        <div className="fixed inset-y-0 left-0 z-20 w-80 p-2 transition duration-300 data-closed:-translate-x-full md:translate-x-full">
          <div className="dark-gradient-subtle dark:ring-dark-700/50 flex h-full flex-col rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/5">
            <SidebarBase onClose={closeSidebar} />
          </div>
        </div>
      </TransitionChild>
    </Transition>
  );
}

/**
 * Sidebar
 *
 * @returns {React.ReactNode} The rendered component
 */
export default function Sidebar() {
  return (
    <>
      <SidebarDesktop />
      <SidebarMobile />
    </>
  );
}
