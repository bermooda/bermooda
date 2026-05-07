import {
  UserIcon,
  ShoppingBagIcon,
  MapPinIcon,
  Cog6ToothIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { Link, NavLink } from 'react-router';

import { useT } from '#/core/i18n/index';

const NAV_ITEMS = [
  { href: '/account', label: 'account.dashboard', Icon: UserIcon, end: true },
  { href: '/account/orders', label: 'account.orders', Icon: ShoppingBagIcon },
  { href: '/account/addresses', label: 'account.addresses', Icon: MapPinIcon },
  { href: '/account/profile', label: 'account.profile', Icon: Cog6ToothIcon },
];

export default function AccountLayout({ children, customer }) {
  const t = useT();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-56">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-700">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {customer?.name}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {customer?.email}
              </p>
            </div>
            <nav className="p-2">
              <ul className="space-y-1">
                {NAV_ITEMS.map(({ href, label, Icon, end }) => (
                  <li key={href}>
                    <NavLink
                      to={href}
                      end={end}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
                            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {t(label)}
                    </NavLink>
                  </li>
                ))}
                <li>
                  <Link
                    to="/account/logout"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <ArrowRightStartOnRectangleIcon className="h-4 w-4 shrink-0" />
                    {t('account.signOut')}
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
