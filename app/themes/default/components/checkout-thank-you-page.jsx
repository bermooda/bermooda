import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router';

import { useT } from '#/core/i18n/index';
import { formatPrice } from '#/core/index';

export default function CheckoutThankYouPage({ order, locale, currency }) {
  const t = useT();

  if (!order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-500">Order not found.</p>
      </div>
    );
  }

  const addr =
    typeof order.shippingAddressSnapshot === 'string'
      ? JSON.parse(order.shippingAddressSnapshot)
      : (order.shippingAddressSnapshot ?? {});

  const displayCurrency = order.currency ?? currency;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      {/* Success icon + heading */}
      <div className="mb-8 text-center">
        <CheckCircleIcon className="mx-auto mb-4 h-16 w-16 text-green-500" />
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('checkout.thankYou.title')}
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {t('checkout.thankYou.subtitle')}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {t('checkout.thankYou.orderNumber')}:{' '}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            #{order.orderNumber}
          </span>
        </p>
      </div>

      {/* Order lines */}
      <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
        <div className="px-6 py-4">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Order Summary
          </h2>
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {(order.lines ?? []).map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between px-6 py-3 text-sm"
            >
              <span className="text-zinc-800 dark:text-zinc-200">
                {line.titleSnapshot}{' '}
                <span className="text-zinc-500">× {line.quantity}</span>
              </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatPrice(
                  line.priceCentsSnapshot * line.quantity,
                  displayCurrency,
                  locale
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            Total
          </span>
          <span className="font-bold text-zinc-900 dark:text-zinc-100">
            {formatPrice(order.totalCents, displayCurrency, locale)}
          </span>
        </div>
      </div>

      {/* Shipping address */}
      {addr?.line1 && (
        <div className="mb-8 rounded-xl border border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">
            Shipping to
          </h2>
          <address className="text-sm text-zinc-600 not-italic dark:text-zinc-400">
            <p>
              {addr.firstName} {addr.lastName}
            </p>
            <p>{addr.line1}</p>
            {addr.line2 && <p>{addr.line2}</p>}
            <p>
              {addr.city}, {addr.state} {addr.postalCode}
            </p>
            <p>{addr.country}</p>
          </address>
        </div>
      )}

      {/* CTA */}
      <div className="text-center">
        <Link
          to="/"
          className="inline-block rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          {t('checkout.thankYou.continueShopping')}
        </Link>
      </div>
    </div>
  );
}
