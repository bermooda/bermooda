import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router';

import { cartLineTotal, formatPrice } from '#/core/index';

function StatusBadge({ status }) {
  const colours = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-zinc-100 text-zinc-800',
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colours[status] ?? 'bg-zinc-100 text-zinc-800'}`}
    >
      {status}
    </span>
  );
}

export default function AccountOrderDetailPage({ order, locale, currency }) {
  if (!order) {
    return (
      <div className="space-y-4">
        <Link
          to="/account/orders"
          className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back to orders
        </Link>
        <p className="text-zinc-500">Order not found.</p>
      </div>
    );
  }

  const addr =
    typeof order.shippingAddressSnapshot === 'string'
      ? JSON.parse(order.shippingAddressSnapshot)
      : (order.shippingAddressSnapshot ?? {});

  const displayCurrency = order.currency ?? currency ?? 'USD';

  return (
    <div className="space-y-6">
      <Link
        to="/account/orders"
        className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Back to orders
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Order #{order.orderNumber}
        </h1>
        <StatusBadge status={order.status} />
      </div>

      <p className="text-sm text-zinc-500">
        Placed on{' '}
        {order.createdAt
          ? new Date(order.createdAt).toLocaleDateString(locale ?? 'en', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : '—'}
      </p>

      {['paid', 'fulfilled', 'confirmed'].includes(order.status) && (
        <Link
          to={`/account/orders/${order.id}/return`}
          className="inline-block text-sm text-indigo-600 hover:underline"
        >
          Request a return
        </Link>
      )}

      {/* Line items */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700">
        <div className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">
          Items
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {(order.lines ?? []).map((line) => (
            <li
              key={line.id}
              className="flex justify-between px-6 py-3 text-sm"
            >
              <span className="text-zinc-800 dark:text-zinc-200">
                {line.titleSnapshot}{' '}
                <span className="text-zinc-500">× {line.quantity}</span>
              </span>
              <span className="font-medium">
                {formatPrice(cartLineTotal(line), displayCurrency, locale)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">
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
        <div className="rounded-xl border border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">
            Shipped to
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
    </div>
  );
}
