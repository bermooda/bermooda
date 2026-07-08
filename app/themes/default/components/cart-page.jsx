import { TrashIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useState } from 'react';
import { Link, Form, useNavigation } from 'react-router';

import { useT } from '#/core/i18n/index';
import {
  cartLineTotal,
  formatPrice,
  resolveProductHref,
  summarizeCartLines,
} from '#/core/index';
import { resolveCatalogMediaUrl } from '#/core/storage/media';
import SlotBlocks from '#/components/slot-blocks';

import StorefrontShell, {
  STOREFRONT_GREEN as GREEN,
} from '#/themes/default/components/storefront-chrome';

export default function CartPage({ cart, locale, currency, slotBlocks = {} }) {
  const t = useT();
  const navigation = useNavigation();
  const [mismatchDismissed, setMismatchDismissed] = useState(false);

  const lines = cart?.lines ?? [];
  const cartCurrency = cart?.currency ?? currency;

  const isSubmitting = navigation.state === 'submitting';

  // Empty state
  if (!cart || lines.length === 0) {
    return (
      <StorefrontShell>
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-8 px-4 py-24 text-center sm:px-6 lg:px-8">
          <div>
            <div
              className="text-[11px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: GREEN }}
            >
              Your cart
            </div>
            <p className="mt-3 font-serif text-3xl text-stone-900">
              {t('cart.empty')}
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            style={{
              background: GREEN,
              boxShadow: '0 12px 28px -12px rgba(47,74,58,.5)',
            }}
          >
            {t('cart.continueShopping')}
          </Link>
        </div>
      </StorefrontShell>
    );
  }

  const { subtotalCents } = summarizeCartLines(lines);

  const showMismatch =
    !mismatchDismissed &&
    cart.currency &&
    currency &&
    cart.currency !== currency;
  const summarySlotBlocks = slotBlocks['cart.summary'] ?? [];
  const slotProps = { cart, locale, currency };

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-10 border-b border-stone-200 pb-8">
          <div
            className="text-[11px] font-semibold tracking-[0.22em] uppercase"
            style={{ color: GREEN }}
          >
            Checkout
          </div>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-stone-900 md:text-5xl">
            {t('cart.title')}
          </h1>
        </div>

        {/* Currency mismatch warning */}
        {showMismatch && (
          <div className="mb-8 flex items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm text-amber-900">
              {t('cart.currencyMismatch', { cartCurrency: cart.currency })}
            </p>
            <button
              type="button"
              onClick={() => setMismatchDismissed(true)}
              className="shrink-0 text-lg leading-none text-amber-700 hover:text-amber-900"
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-12 lg:gap-10">
          {/* Line items */}
          <div className="lg:col-span-7 xl:col-span-8">
            <ul className="divide-y divide-stone-200">
              {lines.map((line) => {
                const product = line.variant?.product;
                const imageUrl = resolveCatalogMediaUrl(product, 128);
                const productHref = resolveProductHref(product) ?? '#';

                return (
                  <li key={line.id} className="flex gap-5 py-8">
                    {/* Product image */}
                    <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-stone-200">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={line.titleSnapshot}
                          className="h-full w-full object-cover object-center"
                        />
                      ) : (
                        <div className="h-full w-full bg-stone-100" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <Link
                            to={productHref}
                            className="font-serif text-lg text-stone-900 hover:underline"
                          >
                            {line.titleSnapshot}
                          </Link>
                          {line.variant?.title && (
                            <p className="mt-1 text-xs text-stone-500">
                              {line.variant.title}
                            </p>
                          )}
                        </div>

                        {/* Unit price */}
                        <div className="shrink-0 text-right">
                          <p className="text-base font-semibold text-stone-900">
                            {formatPrice(
                              cartLineTotal(line),
                              cartCurrency,
                              locale
                            )}
                          </p>
                          <p className="text-xs text-stone-500">
                            {formatPrice(
                              line.priceCentsSnapshot,
                              cartCurrency,
                              locale
                            )}{' '}
                            &times; {line.quantity}
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-2">
                        {/* Quantity editor */}
                        <Form
                          method="post"
                          action="/cart"
                          className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-2 py-1"
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
                              'rounded-full p-2 text-stone-600 transition-colors hover:bg-stone-100',
                              (isSubmitting || line.quantity <= 1) &&
                                'cursor-not-allowed opacity-40'
                            )}
                          >
                            <MinusIcon className="h-4 w-4" />
                          </button>

                          <span className="min-w-[2rem] text-center text-sm font-semibold text-stone-900 select-none">
                            {line.quantity}
                          </span>

                          <button
                            type="submit"
                            name="quantity"
                            value={line.quantity + 1}
                            disabled={isSubmitting}
                            aria-label="Increase quantity"
                            className={clsx(
                              'rounded-full p-2 text-stone-600 transition-colors hover:bg-stone-100',
                              isSubmitting && 'cursor-not-allowed opacity-40'
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
                              'flex items-center gap-1.5 text-xs font-semibold text-rose-600 transition-colors hover:text-rose-800',
                              isSubmitting && 'cursor-not-allowed opacity-40'
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
          <div className="mt-12 lg:col-span-5 lg:mt-0 xl:col-span-4">
            <div className="sticky top-28 rounded-2xl border border-stone-200 bg-white p-8 shadow-lg ring-1 ring-stone-200/60">
              {/* Subtotal */}
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-stone-900">
                <span>{t('cart.subtotal')}</span>
                <span>{formatPrice(subtotalCents, cartCurrency, locale)}</span>
              </div>

              <p className="mb-8 text-xs text-stone-500">
                Shipping and tax calculated at checkout
              </p>

              <SlotBlocks blocks={summarySlotBlocks} slotProps={slotProps} />

              {/* Checkout */}
              <Form method="post" action="/cart">
                <input type="hidden" name="intent" value="checkout" />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={clsx(
                    'w-full rounded-full py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5',
                    isSubmitting && 'cursor-not-allowed opacity-50'
                  )}
                  style={{
                    background: GREEN,
                    boxShadow: '0 12px 28px -12px rgba(47,74,58,.5)',
                  }}
                >
                  {t('cart.checkout')}
                </button>
              </Form>

              {/* Continue shopping */}
              <div className="mt-6 text-center">
                <Link
                  to="/"
                  className="text-sm font-semibold text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline"
                  style={{ color: GREEN }}
                >
                  {t('cart.continueShopping')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}
