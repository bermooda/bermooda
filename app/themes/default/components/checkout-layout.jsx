import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import {
  Link,
  Form,
  useActionData,
  useFetcher,
  useNavigation,
} from 'react-router';

import SlotBlocks from '#/components/storefront/slot-blocks';

import { useT } from '#/core/i18n/index';
import { cartLineTotal, formatPrice, summarizeCartLines } from '#/core/index';
import StorefrontShell, {
  STOREFRONT_GREEN as GREEN,
} from '#/themes/default/components/storefront-chrome';
import StripePaymentElement from '#/themes/default/components/stripe-payment-element';

const COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
];

// ---------------------------------------------------------------------------
// Shared field components
// ---------------------------------------------------------------------------

function SectionCard({ title, children, className }) {
  return (
    <section
      className={clsx(
        'rounded-2xl border border-stone-200 bg-white p-6 shadow-sm ring-1 ring-stone-200/50',
        className
      )}
    >
      <h2 className="mb-5 font-serif text-lg font-semibold text-stone-900">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FieldLabel({ htmlFor, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-sm font-semibold text-stone-700"
    >
      {children}
    </label>
  );
}

function TextInput({
  id,
  name,
  type = 'text',
  defaultValue,
  placeholder,
  required,
  autoComplete,
  onChange,
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      defaultValue={defaultValue ?? ''}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      onChange={onChange}
      className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 shadow-sm focus:border-stone-700 focus:ring-2 focus:ring-stone-200 focus:outline-none"
    />
  );
}

function SubmitButton({ children, disabled, variant = 'primary' }) {
  const isPrimary = variant === 'primary';
  return (
    <button
      type="submit"
      disabled={disabled}
      className={clsx(
        'w-full rounded-full px-6 py-3.5 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 disabled:cursor-not-allowed disabled:opacity-60',
        isPrimary
          ? 'text-white shadow-md hover:-translate-y-0.5 disabled:translate-y-0'
          : 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50'
      )}
      style={
        isPrimary
          ? {
              background: GREEN,
              boxShadow: '0 12px 28px -12px rgba(47,74,58,.45)',
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Order summary (Shopify-style right column)
// ---------------------------------------------------------------------------

function OrderSummary({ cart, totals, currency, locale, t, compact = false }) {
  const lines = cart?.lines ?? [];
  const subtotalCents =
    totals?.subtotalCents ?? summarizeCartLines(lines).subtotalCents;
  const discountCents = totals?.discountCents ?? 0;
  const shippingCents = totals?.shippingCents ?? 0;
  const taxCents = totals?.taxCents ?? 0;
  const storeCreditCents = totals?.storeCreditCents ?? 0;
  const giftCardCents = totals?.giftCardCents ?? 0;
  const loyaltyPointsCents = totals?.loyaltyPointsCents ?? 0;
  const totalCents = totals?.totalCents ?? subtotalCents;

  return (
    <div
      className={clsx(
        'rounded-2xl border border-stone-200 bg-stone-50/80 p-6 shadow-sm ring-1 ring-stone-200/60',
        compact && 'lg:p-5'
      )}
    >
      <h2 className="mb-4 font-serif text-lg font-semibold text-stone-900">
        {t('checkout.orderSummary')}
      </h2>

      {lines.length === 0 ? (
        <p className="text-sm text-stone-500">{t('checkout.emptyCart')}</p>
      ) : (
        <ul className="divide-y divide-stone-200">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-start justify-between gap-3 py-3 first:pt-0"
            >
              <div className="flex min-w-0 flex-1 gap-3">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-500"
                  aria-hidden
                >
                  {line.quantity}×
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {line.titleSnapshot}
                  </p>
                  {!compact && (
                    <p className="text-xs text-stone-500">
                      {t('checkout.qty')}: {line.quantity}
                    </p>
                  )}
                </div>
              </div>
              <p className="shrink-0 text-sm font-semibold text-stone-900">
                {formatPrice(cartLineTotal(line), currency, locale)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-2 border-t border-stone-200 pt-4 text-sm">
        <div className="flex justify-between text-stone-600">
          <span>{t('checkout.subtotal')}</span>
          <span>{formatPrice(subtotalCents, currency, locale)}</span>
        </div>
        {discountCents > 0 && (
          <div className="flex justify-between text-green-700">
            <span>{t('order.discount')}</span>
            <span>-{formatPrice(discountCents, currency, locale)}</span>
          </div>
        )}
        <div className="flex justify-between text-stone-600">
          <span>{t('checkout.shipping')}</span>
          <span>
            {shippingCents === 0 && !totals
              ? '—'
              : shippingCents === 0
                ? t('checkout.free')
                : formatPrice(shippingCents, currency, locale)}
          </span>
        </div>
        {taxCents > 0 && (
          <div className="flex justify-between text-stone-600">
            <span>{t('order.tax')}</span>
            <span>{formatPrice(taxCents, currency, locale)}</span>
          </div>
        )}
        {storeCreditCents > 0 && (
          <div className="flex justify-between text-green-700">
            <span>{t('checkout.tenders.storeCreditApplied')}</span>
            <span>-{formatPrice(storeCreditCents, currency, locale)}</span>
          </div>
        )}
        {giftCardCents > 0 && (
          <div className="flex justify-between text-green-700">
            <span>{t('checkout.tenders.giftCardApplied')}</span>
            <span>-{formatPrice(giftCardCents, currency, locale)}</span>
          </div>
        )}
        {loyaltyPointsCents > 0 && (
          <div className="flex justify-between text-green-700">
            <span>{t('checkout.tenders.loyaltyApplied')}</span>
            <span>-{formatPrice(loyaltyPointsCents, currency, locale)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-stone-300 pt-3 text-base font-bold text-stone-900">
          <span>{t('checkout.total')}</span>
          <span>{formatPrice(totalCents, currency, locale)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function CheckoutLayout({
  session,
  cart,
  shippingQuotes: loaderShippingQuotes,
  paymentProviders,
  totals: loaderTotals,
  tenderBalances,
  locale,
  currency,
  slotBlocks = {},
}) {
  const t = useT();
  const navigation = useNavigation();
  const actionData = useActionData();
  const updateFetcher = useFetcher();
  const formRef = useRef(null);
  const debounceRef = useRef(null);

  const isSubmitting = navigation.state === 'submitting';
  const isUpdating = updateFetcher.state !== 'idle';
  const paymentElement = actionData?.paymentElement ?? null;
  const error = actionData?.error ?? updateFetcher.data?.error ?? null;

  const shippingQuotes =
    updateFetcher.data?.shippingQuotes ?? loaderShippingQuotes ?? [];
  const totals = updateFetcher.data?.totals ?? loaderTotals ?? null;
  const displaySession = updateFetcher.data?.session ?? session;

  const effectiveCurrency = currency ?? cart?.currency ?? 'USD';
  const effectiveLocale = locale ?? 'en';
  const addr = displaySession?.shippingAddress ?? {};
  const options = shippingQuotes ?? [];
  const defaultProvider =
    displaySession?.paymentProvider ?? paymentProviders?.[0]?.id ?? 'stripe';
  const afterPaymentBlocks = slotBlocks['checkout.afterPayment'] ?? [];

  function scheduleShippingUpdate() {
    if (!formRef.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const fd = new FormData(formRef.current);
      fd.set('intent', 'update');
      updateFetcher.submit(fd, { method: 'post' });
    }, 600);
  }

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const slotProps = {
    session: displaySession,
    cart,
    shippingQuotes,
    paymentProviders,
    totals,
    tenderBalances,
    locale: effectiveLocale,
    currency: effectiveCurrency,
  };

  if (paymentElement) {
    return (
      <StorefrontShell>
        <div className="mx-auto max-w-lg px-4 py-14">
          <SectionCard title={t('checkout.completePayment')}>
            <StripePaymentElement
              publishableKey={paymentElement.publishableKey}
              clientSecret={paymentElement.clientSecret}
              orderNumber={paymentElement.orderNumber}
            />
          </SectionCard>
        </div>
      </StorefrontShell>
    );
  }

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-stone-200 pb-6">
          <div>
            <div
              className="text-[11px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: GREEN }}
            >
              {t('checkout.secureLabel')}
            </div>
            <h1 className="mt-1 font-serif text-3xl tracking-tight text-stone-900 md:text-4xl">
              {t('checkout.title')}
            </h1>
          </div>
          <Link
            to="/cart"
            className="text-sm font-medium text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            {t('cart.title')}
          </Link>
        </div>

        <Form
          method="post"
          ref={formRef}
          className="lg:grid lg:grid-cols-12 lg:gap-10"
        >
          <input type="hidden" name="intent" value="place-order" />

          <div className="space-y-6 lg:col-span-7">
            {error && (
              <p
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            {/* Contact */}
            <SectionCard title={t('checkout.sections.contact')}>
              {!displaySession?.email && (
                <div>
                  <FieldLabel htmlFor="email">{t('auth.email')}</FieldLabel>
                  <TextInput
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
              )}
              {displaySession?.email && (
                <p className="text-sm text-stone-700">{displaySession.email}</p>
              )}
            </SectionCard>

            {/* Delivery */}
            <SectionCard title={t('checkout.sections.delivery')}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="firstName">
                      {t('address.firstName')}
                    </FieldLabel>
                    <TextInput
                      id="firstName"
                      name="firstName"
                      defaultValue={addr.firstName}
                      required
                      autoComplete="given-name"
                      onChange={scheduleShippingUpdate}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="lastName">
                      {t('address.lastName')}
                    </FieldLabel>
                    <TextInput
                      id="lastName"
                      name="lastName"
                      defaultValue={addr.lastName}
                      required
                      autoComplete="family-name"
                      onChange={scheduleShippingUpdate}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel htmlFor="line1">{t('address.line1')}</FieldLabel>
                  <TextInput
                    id="line1"
                    name="line1"
                    defaultValue={addr.line1}
                    required
                    autoComplete="address-line1"
                    onChange={scheduleShippingUpdate}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="line2">{t('address.line2')}</FieldLabel>
                  <TextInput
                    id="line2"
                    name="line2"
                    defaultValue={addr.line2}
                    autoComplete="address-line2"
                    onChange={scheduleShippingUpdate}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="city">{t('address.city')}</FieldLabel>
                    <TextInput
                      id="city"
                      name="city"
                      defaultValue={addr.city}
                      required
                      autoComplete="address-level2"
                      onChange={scheduleShippingUpdate}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="state">
                      {t('address.state')}
                    </FieldLabel>
                    <TextInput
                      id="state"
                      name="state"
                      defaultValue={addr.state}
                      autoComplete="address-level1"
                      onChange={scheduleShippingUpdate}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="postalCode">
                      {t('address.postalCode')}
                    </FieldLabel>
                    <TextInput
                      id="postalCode"
                      name="postalCode"
                      defaultValue={addr.postalCode}
                      required
                      autoComplete="postal-code"
                      onChange={scheduleShippingUpdate}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="country">
                      {t('address.country')}
                    </FieldLabel>
                    <select
                      id="country"
                      name="country"
                      defaultValue={addr.country ?? 'US'}
                      required
                      autoComplete="country"
                      onChange={scheduleShippingUpdate}
                      className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 shadow-sm focus:border-stone-700 focus:ring-2 focus:ring-stone-200 focus:outline-none"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <FieldLabel htmlFor="phone">{t('address.phone')}</FieldLabel>
                  <TextInput
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={addr.phone}
                    autoComplete="tel"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="vatId">
                      {t('checkout.vatIdOptional')}
                    </FieldLabel>
                    <TextInput
                      id="vatId"
                      name="vatId"
                      defaultValue={displaySession?.vatId ?? ''}
                      placeholder="e.g. GB123456789"
                      onChange={scheduleShippingUpdate}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="couponCode">
                      {t('checkout.promoOptional')}
                    </FieldLabel>
                    <TextInput
                      id="couponCode"
                      name="couponCode"
                      defaultValue={displaySession?.couponCode ?? ''}
                      placeholder="SAVE10"
                      onChange={scheduleShippingUpdate}
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Shipping method */}
            <SectionCard title={t('checkout.sections.shipping')}>
              {isUpdating && (
                <p className="mb-3 text-sm text-stone-500">
                  {t('checkout.updatingRates')}
                </p>
              )}
              {options.length === 0 ? (
                <p className="text-sm text-stone-600">
                  {t('checkout.enterAddressForRates')}
                </p>
              ) : (
                <div className="space-y-2">
                  {options.map((option) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-stone-200 bg-stone-50/50 p-4 transition-colors hover:border-stone-400 has-[:checked]:border-stone-900 has-[:checked]:bg-white"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shippingOptionId"
                          value={option.id}
                          defaultChecked={
                            displaySession?.shippingOptionId === option.id ||
                            (!displaySession?.shippingOptionId &&
                              option.id === options[0]?.id)
                          }
                          onChange={scheduleShippingUpdate}
                          className="h-4 w-4 border-stone-300 text-stone-900 focus:ring-stone-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-stone-900">
                            {option.name}
                          </span>
                          {option.pickupAddress && (
                            <p className="text-xs text-stone-500">
                              {[
                                option.pickupAddress.line1,
                                option.pickupAddress.city,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-stone-700">
                        {option.priceCents === 0
                          ? t('checkout.free')
                          : formatPrice(
                              option.priceCents,
                              effectiveCurrency,
                              effectiveLocale
                            )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Payment */}
            <SectionCard title={t('checkout.sections.payment')}>
              <fieldset className="mb-5 space-y-4">
                <legend className="mb-2 text-sm font-semibold text-stone-800">
                  {t('checkout.tenders.title')}
                </legend>

                <div>
                  <FieldLabel htmlFor="giftCardCode">
                    {t('checkout.tenders.giftCard')}
                  </FieldLabel>
                  <TextInput
                    id="giftCardCode"
                    name="giftCardCode"
                    defaultValue={displaySession?.giftCardCode ?? ''}
                    placeholder="XXXX-XXXX-XXXX"
                    onChange={scheduleShippingUpdate}
                  />
                </div>

                {tenderBalances?.isLoggedIn &&
                  tenderBalances.storeCreditBalanceCents > 0 && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4 has-[:checked]:border-stone-900 has-[:checked]:bg-white">
                      <input
                        type="checkbox"
                        name="useStoreCredit"
                        defaultChecked={
                          (displaySession?.storeCreditCents ?? 0) > 0
                        }
                        onChange={scheduleShippingUpdate}
                        className="mt-0.5 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                      />
                      <span className="text-sm text-stone-900">
                        {t('checkout.tenders.applyStoreCredit')}{' '}
                        <span className="font-semibold">
                          {formatPrice(
                            tenderBalances.storeCreditBalanceCents,
                            effectiveCurrency,
                            effectiveLocale
                          )}
                        </span>
                      </span>
                    </label>
                  )}

                {tenderBalances?.isLoggedIn &&
                  tenderBalances.loyaltyEnabled &&
                  tenderBalances.loyaltyBalance > 0 && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4 has-[:checked]:border-stone-900 has-[:checked]:bg-white">
                      <input
                        type="checkbox"
                        name="useLoyalty"
                        defaultChecked={
                          (displaySession?.loyaltyPointsCents ?? 0) > 0
                        }
                        onChange={scheduleShippingUpdate}
                        className="mt-0.5 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                      />
                      <span className="text-sm text-stone-900">
                        {t('checkout.tenders.applyLoyalty', {
                          points:
                            tenderBalances.loyaltyBalance.toLocaleString(),
                          value: formatPrice(
                            tenderBalances.loyaltyValueCents,
                            effectiveCurrency,
                            effectiveLocale
                          ),
                        })}
                      </span>
                    </label>
                  )}

                {tenderBalances && !tenderBalances.isLoggedIn && (
                  <p className="text-sm text-stone-500">
                    {t('checkout.tenders.signInPrompt')}{' '}
                    <Link
                      to="/account/login"
                      className="font-medium text-stone-800 underline-offset-4 hover:underline"
                    >
                      {t('nav.signIn')}
                    </Link>
                  </p>
                )}
              </fieldset>

              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-stone-800">
                  {t('checkout.sections.paymentMethod')}
                </legend>
                <div className="space-y-2">
                  {(paymentProviders ?? []).map((provider) => (
                    <label
                      key={provider.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-stone-200 bg-stone-50/50 p-4 transition-colors hover:border-stone-400 has-[:checked]:border-stone-900 has-[:checked]:bg-white"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="paymentProvider"
                          value={provider.id}
                          defaultChecked={provider.id === defaultProvider}
                          className="h-4 w-4 border-stone-300 text-stone-900 focus:ring-stone-500"
                        />
                        <span className="text-sm font-medium text-stone-900">
                          {provider.name}
                        </span>
                      </div>
                      {provider.supportsPaymentElement && (
                        <span className="text-xs text-stone-500">
                          {t('checkout.paymentElement')}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
            </SectionCard>

            {afterPaymentBlocks.length > 0 && (
              <SlotBlocks blocks={afterPaymentBlocks} slotProps={slotProps} />
            )}

            <div className="lg:hidden">
              <SubmitButton disabled={isSubmitting || isUpdating}>
                {isSubmitting ? t('common.loading') : t('checkout.payNow')}
              </SubmitButton>
            </div>
          </div>

          {/* Order summary sidebar */}
          <div className="mt-8 lg:col-span-5 lg:mt-0">
            <div className="lg:sticky lg:top-24">
              <OrderSummary
                cart={cart}
                totals={totals}
                currency={effectiveCurrency}
                locale={effectiveLocale}
                t={t}
              />
              <div className="mt-4 hidden lg:block">
                <SubmitButton disabled={isSubmitting || isUpdating}>
                  {isSubmitting ? t('common.loading') : t('checkout.payNow')}
                </SubmitButton>
              </div>
            </div>
          </div>
        </Form>
      </div>
    </StorefrontShell>
  );
}
