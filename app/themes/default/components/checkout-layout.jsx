import { CheckIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Link, Form, useNavigation } from 'react-router';

import { useT } from '#/core/i18n/index';
import { formatPrice } from '#/core/index';
import StorefrontShell, {
  STOREFRONT_GREEN as GREEN,
} from '#/themes/default/components/storefront-chrome';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = ['address', 'shipping', 'payment', 'review'];

const STEP_BACK = {
  shipping: '/checkout/address',
  payment: '/checkout/shipping',
  review: '/checkout/payment',
};

const COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
];

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ currentStep, t }) {
  const stepLabels = [
    t('checkout.steps.address'),
    t('checkout.steps.shipping'),
    t('checkout.steps.payment'),
    t('checkout.steps.review'),
  ];

  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <nav aria-label="Checkout steps" className="mb-10">
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                    isCompleted && 'border-transparent text-white',
                    isCurrent &&
                      'border-stone-900 bg-white text-stone-900 shadow-sm',
                    !isCompleted &&
                      !isCurrent &&
                      'border-stone-200 bg-white text-stone-400'
                  )}
                  style={
                    isCompleted
                      ? { background: GREEN, borderColor: GREEN }
                      : undefined
                  }
                >
                  {isCompleted ? (
                    <CheckIcon className="h-4 w-4 text-white" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={clsx(
                    'hidden text-sm font-medium sm:block',
                    isCurrent
                      ? 'text-stone-900'
                      : isCompleted
                        ? 'text-stone-700'
                        : 'text-stone-400'
                  )}
                >
                  {stepLabels[index]}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={clsx(
                    'mx-3 h-px flex-1',
                    index < currentIndex ? 'bg-stone-800' : 'bg-stone-200'
                  )}
                  style={
                    index < currentIndex ? { background: GREEN } : undefined
                  }
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Order summary panel
// ---------------------------------------------------------------------------

function OrderSummary({ cart, currency, locale, t }) {
  const lines = cart?.lines ?? [];
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.priceCentsSnapshot * line.quantity,
    0
  );

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-md ring-1 ring-stone-200/60">
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
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">
                  {line.titleSnapshot}
                </p>
                <p className="text-sm text-stone-500">
                  {t('checkout.qty')}: {line.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold text-stone-900">
                {formatPrice(
                  line.priceCentsSnapshot * line.quantity,
                  currency,
                  locale
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-stone-200 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-600">
            {t('checkout.subtotal')}
          </span>
          <span className="text-sm font-semibold text-stone-900">
            {formatPrice(subtotalCents, currency, locale)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared field components
// ---------------------------------------------------------------------------

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
      className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 shadow-sm focus:border-stone-700 focus:ring-2 focus:ring-stone-200 focus:outline-none"
    />
  );
}

function SubmitButton({ children, disabled }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-full px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        background: GREEN,
        boxShadow: '0 12px 28px -12px rgba(47,74,58,.45)',
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Address step
// ---------------------------------------------------------------------------

function AddressStep({ session, t, isSubmitting }) {
  const addr = session?.shippingAddress ?? {};

  return (
    <Form method="post" className="space-y-5">
      {!session?.email && (
        <div>
          <FieldLabel htmlFor="email">{t('checkout.email')}</FieldLabel>
          <TextInput
            id="email"
            name="email"
            type="email"
            defaultValue=""
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel htmlFor="firstName">{t('checkout.firstName')}</FieldLabel>
          <TextInput
            id="firstName"
            name="firstName"
            defaultValue={addr.firstName}
            required
            autoComplete="given-name"
          />
        </div>
        <div>
          <FieldLabel htmlFor="lastName">{t('checkout.lastName')}</FieldLabel>
          <TextInput
            id="lastName"
            name="lastName"
            defaultValue={addr.lastName}
            required
            autoComplete="family-name"
          />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="line1">{t('checkout.address1')}</FieldLabel>
        <TextInput
          id="line1"
          name="line1"
          defaultValue={addr.line1}
          required
          autoComplete="address-line1"
        />
      </div>

      <div>
        <FieldLabel htmlFor="line2">{t('checkout.address2')}</FieldLabel>
        <TextInput
          id="line2"
          name="line2"
          defaultValue={addr.line2}
          autoComplete="address-line2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel htmlFor="city">{t('checkout.city')}</FieldLabel>
          <TextInput
            id="city"
            name="city"
            defaultValue={addr.city}
            required
            autoComplete="address-level2"
          />
        </div>
        <div>
          <FieldLabel htmlFor="state">{t('checkout.state')}</FieldLabel>
          <TextInput
            id="state"
            name="state"
            defaultValue={addr.state}
            autoComplete="address-level1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel htmlFor="postalCode">
            {t('checkout.postalCode')}
          </FieldLabel>
          <TextInput
            id="postalCode"
            name="postalCode"
            defaultValue={addr.postalCode}
            required
            autoComplete="postal-code"
          />
        </div>
        <div>
          <FieldLabel htmlFor="country">{t('checkout.country')}</FieldLabel>
          <select
            id="country"
            name="country"
            defaultValue={addr.country ?? 'US'}
            required
            autoComplete="country"
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
        <FieldLabel htmlFor="phone">{t('checkout.phone')}</FieldLabel>
        <TextInput
          id="phone"
          name="phone"
          type="tel"
          defaultValue={addr.phone}
          autoComplete="tel"
        />
      </div>

      <div>
        <FieldLabel htmlFor="vatId">VAT / GST ID (optional)</FieldLabel>
        <TextInput
          id="vatId"
          name="vatId"
          defaultValue={session?.vatId ?? ''}
          placeholder="e.g. GB123456789"
        />
      </div>

      <div>
        <FieldLabel htmlFor="couponCode">Promo code (optional)</FieldLabel>
        <TextInput
          id="couponCode"
          name="couponCode"
          defaultValue={session?.couponCode ?? ''}
          placeholder="SAVE10"
        />
      </div>

      <input type="hidden" name="_action" value="address" />

      <div className="pt-2">
        <SubmitButton disabled={isSubmitting}>
          {isSubmitting
            ? t('common.loading')
            : t('checkout.continueToShipping')}
        </SubmitButton>
      </div>
    </Form>
  );
}

// ---------------------------------------------------------------------------
// Shipping step
// ---------------------------------------------------------------------------

function ShippingStep({
  session,
  shippingQuotes,
  currency,
  locale,
  t,
  isSubmitting,
}) {
  const addr = session?.shippingAddress ?? {};

  // getAllQuotes returns a flat array of ShippingOption objects
  const options =
    shippingQuotes?.length > 0
      ? shippingQuotes
      : [
          {
            id: 'standard',
            name: 'Standard Shipping',
            priceCents: 0,
          },
        ];

  return (
    <div className="space-y-6">
      {/* Shipping address recap */}
      {addr.firstName && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm ring-1 ring-stone-200/50">
          <p className="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">
            {t('checkout.shippingTo')}
          </p>
          <p className="text-sm text-stone-900">
            {addr.firstName} {addr.lastName}
          </p>
          <p className="text-sm text-stone-600">
            {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ''}
          </p>
          <p className="text-sm text-stone-600">
            {addr.city}
            {addr.state ? `, ${addr.state}` : ''} {addr.postalCode}
          </p>
          <p className="text-sm text-stone-600">{addr.country}</p>
        </div>
      )}

      <Form method="post" className="space-y-4">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-stone-900">
            {t('checkout.shippingMethod')}
          </legend>
          <div className="space-y-2">
            {options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:border-stone-400 has-[:checked]:border-stone-900 has-[:checked]:bg-stone-50"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="shippingOptionId"
                    value={option.id}
                    defaultChecked={
                      session?.shippingOptionId === option.id ||
                      (!session?.shippingOptionId &&
                        option.id === options[0]?.id)
                    }
                    className="h-4 w-4 border-stone-300 text-stone-900 focus:ring-stone-500"
                  />
                  <span className="text-sm font-medium text-stone-900">
                    {option.name}
                  </span>
                </div>
                <span className="text-sm text-stone-600">
                  {option.priceCents === 0
                    ? t('checkout.free')
                    : formatPrice(option.priceCents, currency, locale)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <input type="hidden" name="_action" value="shipping" />

        <div className="pt-2">
          <SubmitButton disabled={isSubmitting}>
            {isSubmitting
              ? t('common.loading')
              : t('checkout.continueToPayment')}
          </SubmitButton>
        </div>
      </Form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment step
// ---------------------------------------------------------------------------

function PaymentStep({
  session,
  cart,
  paymentProviders,
  totals,
  currency,
  locale,
  t,
  isSubmitting,
}) {
  const defaultProvider =
    session?.paymentProvider ?? paymentProviders?.[0]?.id ?? 'stripe';

  const displayTotal = totals?.totalCents ?? cart?.lines?.reduce(
    (sum, line) => sum + line.priceCentsSnapshot * line.quantity,
    0
  );

  return (
    <Form method="post" className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-stone-900">
          Payment method
        </legend>
        <div className="space-y-2">
          {(paymentProviders ?? []).map((provider) => (
            <label
              key={provider.id}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:border-stone-400 has-[:checked]:border-stone-900 has-[:checked]:bg-stone-50"
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
                <span className="text-xs text-stone-500">Cards · Apple Pay</span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm ring-1 ring-stone-200/50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-700">
            {t('checkout.orderTotal')}
          </span>
          <span className="text-base font-bold text-stone-900">
            {formatPrice(displayTotal, currency, locale)}
          </span>
        </div>
      </div>

      <input type="hidden" name="_action" value="payment" />

      <SubmitButton disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('checkout.continueToReview')}
      </SubmitButton>
    </Form>
  );
}

// ---------------------------------------------------------------------------
// Review step
// ---------------------------------------------------------------------------

function ReviewStep({
  session,
  cart,
  shippingQuotes,
  paymentProviders,
  totals,
  currency,
  locale,
  t,
  isSubmitting,
}) {
  const addr = session?.shippingAddress ?? {};
  const lines = cart?.lines ?? [];

  const selectedOption = (shippingQuotes ?? []).find(
    (o) => o.id === session?.shippingOptionId
  );
  const shippingLabel = selectedOption?.name ?? t('checkout.standardShipping');
  const shippingCents = totals?.shippingCents ?? selectedOption?.priceCents ?? 0;

  const subtotalCents =
    totals?.subtotalCents ??
    lines.reduce(
      (sum, line) => sum + line.priceCentsSnapshot * line.quantity,
      0
    );
  const discountCents = totals?.discountCents ?? 0;
  const taxCents = totals?.taxCents ?? 0;
  const totalCents =
    totals?.totalCents ?? subtotalCents - discountCents + shippingCents + taxCents;

  const selectedProvider = paymentProviders?.find(
    (p) => p.id === session?.paymentProvider
  );
  const paymentLabel =
    selectedProvider?.name ?? paymentProviders?.[0]?.name ?? 'Stripe';

  return (
    <div className="space-y-6">
      {/* Address recap */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm ring-1 ring-stone-200/40">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
          {t('checkout.steps.address')}
        </h3>
        <p className="text-sm text-stone-900">
          {addr.firstName} {addr.lastName}
        </p>
        <p className="text-sm text-stone-600">
          {addr.line1}
          {addr.line2 ? `, ${addr.line2}` : ''}
        </p>
        <p className="text-sm text-stone-600">
          {addr.city}
          {addr.state ? `, ${addr.state}` : ''} {addr.postalCode}
        </p>
        <p className="text-sm text-stone-600">{addr.country}</p>
      </div>

      {/* Shipping method */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm ring-1 ring-stone-200/40">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
          {t('checkout.steps.shipping')}
        </h3>
        <div className="flex items-center justify-between">
          <p className="text-sm text-stone-900">{shippingLabel}</p>
          <p className="text-sm text-stone-600">
            {shippingCents === 0
              ? t('checkout.free')
              : formatPrice(shippingCents, currency, locale)}
          </p>
        </div>
      </div>

      {/* Payment */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm ring-1 ring-stone-200/40">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
          {t('checkout.steps.payment')}
        </h3>
        <p className="text-sm text-stone-900">{paymentLabel}</p>
      </div>

      {/* Line items */}
      <div>
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-stone-500 uppercase">
          {t('checkout.items')}
        </h3>
        <ul className="divide-y divide-stone-200">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between py-3"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">
                  {line.titleSnapshot}
                </p>
                <p className="text-sm text-stone-500">
                  {t('checkout.qty')}: {line.quantity}
                </p>
              </div>
              <p className="text-sm font-medium text-stone-900">
                {formatPrice(
                  line.priceCentsSnapshot * line.quantity,
                  currency,
                  locale
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Totals */}
      <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm ring-1 ring-stone-200/50">
        <div className="flex justify-between text-sm text-stone-600">
          <span>{t('checkout.subtotal')}</span>
          <span>{formatPrice(subtotalCents, currency, locale)}</span>
        </div>
        {discountCents > 0 && (
          <div className="flex justify-between text-sm text-green-700">
            <span>Discount</span>
            <span>-{formatPrice(discountCents, currency, locale)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-stone-600">
          <span>{t('checkout.shipping')}</span>
          <span>
            {shippingCents === 0
              ? t('checkout.free')
              : formatPrice(shippingCents, currency, locale)}
          </span>
        </div>
        {taxCents > 0 && (
          <div className="flex justify-between text-sm text-stone-600">
            <span>Tax</span>
            <span>{formatPrice(taxCents, currency, locale)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-stone-200 pt-2 text-sm font-bold text-stone-900">
          <span>{t('checkout.total')}</span>
          <span>{formatPrice(totalCents, currency, locale)}</span>
        </div>
      </div>

      <Form method="post" className="space-y-3">
        <input type="hidden" name="_action" value="review" />
        <SubmitButton disabled={isSubmitting}>
          {isSubmitting ? t('common.loading') : t('checkout.placeOrder')}
        </SubmitButton>
      </Form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function CheckoutLayout({
  step,
  session,
  cart,
  shippingQuotes,
  paymentProviders,
  totals,
  locale,
  currency,
}) {
  const t = useT();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const currentStep = step ?? session?.step ?? 'address';
  const backHref = STEP_BACK[currentStep];
  const effectiveCurrency = currency ?? cart?.currency ?? 'USD';
  const effectiveLocale = locale ?? 'en';

  function renderStep() {
    switch (currentStep) {
      case 'address':
        return (
          <AddressStep session={session} t={t} isSubmitting={isSubmitting} />
        );
      case 'shipping':
        return (
          <ShippingStep
            session={session}
            shippingQuotes={shippingQuotes}
            currency={effectiveCurrency}
            locale={effectiveLocale}
            t={t}
            isSubmitting={isSubmitting}
          />
        );
      case 'payment':
        return (
          <PaymentStep
            session={session}
            cart={cart}
            paymentProviders={paymentProviders}
            totals={totals}
            currency={effectiveCurrency}
            locale={effectiveLocale}
            t={t}
            isSubmitting={isSubmitting}
          />
        );
      case 'review':
        return (
          <ReviewStep
            session={session}
            cart={cart}
            shippingQuotes={shippingQuotes}
            paymentProviders={paymentProviders}
            totals={totals}
            currency={effectiveCurrency}
            locale={effectiveLocale}
            t={t}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  }

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {/* Page title */}
        <div className="mb-10 border-b border-stone-200 pb-8">
          <div
            className="text-[11px] font-semibold tracking-[0.22em] uppercase"
            style={{ color: GREEN }}
          >
            Secure checkout
          </div>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-stone-900 md:text-5xl">
            {t('checkout.title')}
          </h1>
        </div>

        {/* Step indicator */}
        <StepIndicator currentStep={currentStep} t={t} />

        <div className="lg:grid lg:grid-cols-12 lg:gap-12">
          {/* Main content */}
          <div className="lg:col-span-7">
            <div className="mb-6">
              <h2 className="font-serif text-xl font-semibold text-stone-900">
                {t(`checkout.steps.${currentStep}`)}
              </h2>
            </div>

            {renderStep()}

            {/* Back link */}
            {backHref && currentStep !== 'review' && (
              <div className="mt-6">
                <Link
                  to={backHref}
                  className="text-sm font-medium text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline"
                >
                  {t('checkout.back')}
                </Link>
              </div>
            )}
            {currentStep === 'review' && backHref && (
              <div className="mt-4">
                <Link
                  to={backHref}
                  className="text-sm font-medium text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline"
                >
                  {t('checkout.back')}
                </Link>
              </div>
            )}
          </div>

          {/* Order summary sidebar */}
          <div className="mt-10 lg:col-span-5 lg:mt-0">
            <div className="lg:sticky lg:top-28">
              <OrderSummary
                cart={cart}
                currency={effectiveCurrency}
                locale={effectiveLocale}
                t={t}
              />
            </div>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}
