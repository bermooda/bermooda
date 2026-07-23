import {
  UserIcon,
  ShoppingBagIcon,
  MapPinIcon,
  Cog6ToothIcon,
  HeartIcon,
  GiftIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { Link, NavLink } from 'react-router';

import { useT } from '#/core/i18n';

import StorefrontShell from '#/themes/default/components/storefront-chrome';

const NAV_ITEMS = [
  { href: '/account', label: 'account.dashboard', Icon: UserIcon, end: true },
  { href: '/account/orders', label: 'account.orders', Icon: ShoppingBagIcon },
  { href: '/account/wishlist', label: 'account.wishlist', Icon: HeartIcon },
  { href: '/account/loyalty', label: 'account.loyalty', Icon: GiftIcon },
  { href: '/account/addresses', label: 'account.addresses', Icon: MapPinIcon },
  { href: '/account/profile', label: 'account.profile', Icon: Cog6ToothIcon },
];

export default function AccountLayout({ children, customer }) {
  const t = useT();

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <aside className="w-full shrink-0 lg:w-56">
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm ring-1 ring-stone-200/60">
              <div className="border-b border-stone-200 px-4 py-4">
                <div className="text-[10px] font-semibold tracking-[0.2em] text-stone-500 uppercase">
                  Signed in
                </div>
                <p className="mt-1 truncate font-serif text-base font-semibold text-stone-900">
                  {customer?.name}
                </p>
                <p className="truncate text-xs text-stone-500">
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
                          `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-stone-100 text-stone-900'
                              : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
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
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900"
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
    </StorefrontShell>
  );
}
