import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router';

import { useT } from '#/core/i18n/index';
import { cartLineTotal, formatPrice } from '#/core/index';

import StorefrontShell, {
  STOREFRONT_GREEN as GREEN,
} from '#/themes/default/components/storefront-chrome';

export default function CheckoutThankYouPage({ order, locale, currency }) {
  const t = useT();

  if (!order) {
    return (
      <StorefrontShell>
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <p className="text-stone-500">Order not found.</p>
        </div>
      </StorefrontShell>
    );
  }

  const addr =
    typeof order.shippingAddressSnapshot === 'string'
      ? JSON.parse(order.shippingAddressSnapshot)
      : (order.shippingAddressSnapshot ?? {});

  const displayCurrency = order.currency ?? currency;

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 lg:py-20">
        {/* Success icon + heading */}
        <div className="mb-10 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: `${GREEN}18`, color: GREEN }}
          >
            <CheckCircleIcon className="h-10 w-10" />
          </div>
          <div
            className="text-[11px] font-semibold tracking-[0.22em] uppercase"
            style={{ color: GREEN }}
          >
            Thank you
          </div>
          <h1 className="mt-3 font-serif text-4xl text-stone-900 md:text-5xl">
            {t('checkout.thankYou.title')}
          </h1>
          <p className="mt-3 text-stone-600">
            {t('checkout.thankYou.subtitle')}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            {t('checkout.thankYou.orderNumber')}:{' '}
            <span className="font-semibold text-stone-900">
              #{order.orderNumber}
            </span>
          </p>
        </div>

        {/* Order lines */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-md ring-1 ring-stone-200/60">
          <div className="border-b border-stone-200 px-6 py-4">
            <h2 className="font-serif text-lg font-semibold text-stone-900">
              Order Summary
            </h2>
          </div>
          <ul className="divide-y divide-stone-200">
            {(order.lines ?? []).map((line) => (
              <li
                key={line.id}
                className="flex items-center justify-between px-6 py-3 text-sm"
              >
                <span className="text-stone-800">
                  {line.titleSnapshot}{' '}
                  <span className="text-stone-500">× {line.quantity}</span>
                </span>
                <span className="font-semibold text-stone-900">
                  {formatPrice(cartLineTotal(line), displayCurrency, locale)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
            <span className="font-semibold text-stone-900">Total</span>
            <span className="font-bold text-stone-900">
              {formatPrice(order.totalCents, displayCurrency, locale)}
            </span>
          </div>
        </div>

        {/* Shipping address */}
        {addr?.line1 && (
          <div className="mb-10 rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-sm ring-1 ring-stone-200/50">
            <h2 className="mb-3 font-serif text-lg font-semibold text-stone-900">
              Shipping to
            </h2>
            <address className="text-sm leading-relaxed text-stone-600 not-italic">
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
            className="inline-flex rounded-full px-8 py-3.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            style={{
              background: GREEN,
              boxShadow: '0 12px 28px -12px rgba(47,74,58,.5)',
            }}
          >
            {t('checkout.thankYou.continueShopping')}
          </Link>
        </div>
      </div>
    </StorefrontShell>
  );
}
