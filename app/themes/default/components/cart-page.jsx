import { TrashIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useState } from 'react';
import { Link, Form, useNavigation } from 'react-router';

import { useT } from '#/core/i18n/index';
import { formatPrice } from '#/core/index';

export default function CartPage({ cart, locale, currency }) {
  const t = useT();
  const navigation = useNavigation();
  const [mismatchDismissed, setMismatchDismissed] = useState(false);

  const lines = cart?.lines ?? [];
  const cartCurrency = cart?.currency ?? currency;

  const isSubmitting = navigation.state === 'submitting';

  // Empty state
  if (!cart || lines.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-6 text-center">
          <p className="text-xl text-gray-500 dark:text-gray-400">
            {t('cart.empty')}
          </p>
          <Link
            to="/"
            className="inline-block rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            {t('cart.continueShopping')}
          </Link>
        </div>
      </div>
    );
  }

  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.priceCentsSnapshot * line.quantity,
    0
  );

  const showMismatch =
    !mismatchDismissed &&
    cart.currency &&
    currency &&
    cart.currency !== currency;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">
        {t('cart.title')}
      </h1>

      {/* Currency mismatch warning */}
      {showMismatch && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 dark:border-yellow-700 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            {t('cart.currencyMismatch', { cartCurrency: cart.currency })}
          </p>
          <button
            type="button"
            onClick={() => setMismatchDismissed(true)}
            className="shrink-0 text-lg leading-none text-yellow-700 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-200"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Line items */}
        <div className="lg:col-span-7 xl:col-span-8">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {lines.map((line) => {
              const product = line.variant?.product;
              const imageUrl = product?.media?.[0]?.url;
              const productSlug = product?.slug?.slug || product?.id;
              const productHref = productSlug
                ? `/products/${productSlug}`
                : '#';

              return (
                <li key={line.id} className="flex gap-4 py-6">
                  {/* Product image */}
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={line.titleSnapshot}
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <div className="h-full w-full bg-gray-100 dark:bg-gray-800" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={productHref}
                          className="text-sm font-medium text-gray-900 hover:underline dark:text-white"
                        >
                          {line.titleSnapshot}
                        </Link>
                        {line.variant?.title && (
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {line.variant.title}
                          </p>
                        )}
                      </div>

                      {/* Unit price */}
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatPrice(
                            line.priceCentsSnapshot * line.quantity,
                            cartCurrency,
                            locale
                          )}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {formatPrice(
                            line.priceCentsSnapshot,
                            cartCurrency,
                            locale
                          )}{' '}
                          &times; {line.quantity}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-4">
                      {/* Quantity editor */}
                      <Form
                        method="post"
                        action="/cart"
                        className="flex items-center gap-1"
                      >
                        <input type="hidden" name="intent" value="update" />
                        <input type="hidden" name="lineId" value={line.id} />
                        <button
                          type="submit"
                          name="quantity"
                          value={Math.max(0, line.quantity - 1)}
                          disabled={isSubmitting || line.quantity <= 1}
                          aria-label="Decrease quantity"
                          className={clsx(
                            'rounded p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
                            (isSubmitting || line.quantity <= 1) &&
                              'opacity-40 cursor-not-allowed'
                          )}
                        >
                          <MinusIcon className="h-4 w-4" />
                        </button>

                        <span className="w-8 text-center text-sm font-medium text-gray-900 select-none dark:text-white">
                          {line.quantity}
                        </span>

                        <button
                          type="submit"
                          name="quantity"
                          value={line.quantity + 1}
                          disabled={isSubmitting}
                          aria-label="Increase quantity"
                          className={clsx(
                            'rounded p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
                            isSubmitting && 'opacity-40 cursor-not-allowed'
                          )}
                        >
                          <PlusIcon className="h-4 w-4" />
                        </button>
                      </Form>

                      {/* Remove button */}
                      <Form method="post" action="/cart">
                        <input type="hidden" name="intent" value="remove" />
                        <input type="hidden" name="lineId" value={line.id} />
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          aria-label={t('cart.remove')}
                          className={clsx(
                            'flex items-center gap-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors',
                            isSubmitting && 'opacity-40 cursor-not-allowed'
                          )}
                        >
                          <TrashIcon className="h-4 w-4" />
                          <span>{t('cart.remove')}</span>
                        </button>
                      </Form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Order summary */}
        <div className="mt-10 lg:col-span-5 lg:mt-0 xl:col-span-4">
          <div className="sticky top-24 rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900">
            {/* Subtotal */}
            <div className="mb-1 flex items-center justify-between text-sm font-medium text-gray-900 dark:text-white">
              <span>{t('cart.subtotal')}</span>
              <span>{formatPrice(subtotalCents, cartCurrency, locale)}</span>
            </div>

            <p className="mb-6 text-xs text-gray-500 dark:text-gray-400">
              Shipping and tax calculated at checkout
            </p>

            {/* Checkout */}
            <Form method="post" action="/cart">
              <input type="hidden" name="intent" value="checkout" />
              <button
                type="submit"
                disabled={isSubmitting}
                className={clsx(
                  'w-full rounded-md bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors',
                  isSubmitting && 'opacity-50 cursor-not-allowed'
                )}
              >
                {t('cart.checkout')}
              </button>
            </Form>

            {/* Continue shopping */}
            <div className="mt-4 text-center">
              <Link
                to="/"
                className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                {t('cart.continueShopping')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
