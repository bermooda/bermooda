import { CheckIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Link, Form, useNavigation } from 'react-router';

import { useT } from '#/core/i18n/index.js';
import { formatPrice } from '#/core/index.js';

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
    <nav aria-label="Checkout steps" className="mb-8">
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                    isCompleted &&
                      'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900',
                    isCurrent &&
                      'border-gray-900 bg-white text-gray-900 dark:border-white dark:bg-gray-950 dark:text-white',
                    !isCompleted &&
                      !isCurrent &&
                      'border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-500'
                  )}
                >
                  {isCompleted ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={clsx(
                    'hidden sm:block text-sm font-medium',
                    isCurrent
                      ? 'text-gray-900 dark:text-white'
                      : isCompleted
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-400 dark:text-gray-500'
                  )}
                >
                  {stepLabels[index]}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={clsx(
                    'mx-3 h-px flex-1',
                    index < currentIndex
                      ? 'bg-gray-900 dark:bg-white'
                      : 'bg-gray-200 dark:bg-gray-700'
                  )}
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
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900">
      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
        {t('checkout.orderSummary')}
      </h2>

      {lines.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('checkout.emptyCart')}
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {line.titleSnapshot}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('checkout.qty')}: {line.quantity}
                </p>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
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

      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('checkout.subtotal')}
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
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
      className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
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
      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-white dark:focus:ring-white"
    />
  );
}

function SubmitButton({ children, disabled }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-md bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-700 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 dark:focus:ring-white"
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
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
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
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            {t('checkout.shippingTo')}
          </p>
          <p className="text-sm text-gray-900 dark:text-white">
            {addr.firstName} {addr.lastName}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ''}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {addr.city}
            {addr.state ? `, ${addr.state}` : ''} {addr.postalCode}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {addr.country}
          </p>
        </div>
      )}

      <Form method="post" className="space-y-4">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            {t('checkout.shippingMethod')}
          </legend>
          <div className="space-y-2">
            {options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center justify-between rounded-md border border-gray-200 p-4 transition-colors hover:border-gray-400 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-500 dark:has-[:checked]:border-white dark:has-[:checked]:bg-gray-800"
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
                    className="h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-gray-600 dark:text-white dark:focus:ring-white"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {option.name}
                  </span>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
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
  session: _session,
  cart,
  paymentProviders,
  currency,
  locale,
  t,
  isSubmitting,
}) {
  const firstProvider = paymentProviders?.[0];
  const providerId = firstProvider?.id ?? 'stripe';

  const lines = cart?.lines ?? [];
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.priceCentsSnapshot * line.quantity,
    0
  );

  return (
    <Form method="post" className="space-y-6">
      <div className="rounded-md border border-gray-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          {t('checkout.redirectNotice')}
        </p>
      </div>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('checkout.orderTotal')}
          </span>
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {formatPrice(subtotalCents, currency, locale)}
          </span>
        </div>
      </div>

      <input type="hidden" name="paymentProvider" value={providerId} />
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
  currency,
  locale,
  t,
  isSubmitting,
}) {
  const addr = session?.shippingAddress ?? {};
  const lines = cart?.lines ?? [];

  // shippingQuotes is a flat array of ShippingOption objects from getAllQuotes
  const selectedOption = (shippingQuotes ?? []).find(
    (o) => o.id === session?.shippingOptionId
  );
  const shippingLabel = selectedOption?.name ?? t('checkout.standardShipping');
  const shippingCents = selectedOption?.priceCents ?? 0;

  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.priceCentsSnapshot * line.quantity,
    0
  );
  const totalCents = subtotalCents + shippingCents;

  const selectedProvider = paymentProviders?.find(
    (p) => p.id === session?.paymentProvider
  );
  const paymentLabel =
    selectedProvider?.name ?? paymentProviders?.[0]?.name ?? 'Stripe';

  return (
    <div className="space-y-6">
      {/* Address recap */}
      <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {t('checkout.steps.address')}
        </h3>
        <p className="text-sm text-gray-900 dark:text-white">
          {addr.firstName} {addr.lastName}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {addr.line1}
          {addr.line2 ? `, ${addr.line2}` : ''}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {addr.city}
          {addr.state ? `, ${addr.state}` : ''} {addr.postalCode}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {addr.country}
        </p>
      </div>

      {/* Shipping method */}
      <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {t('checkout.steps.shipping')}
        </h3>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-900 dark:text-white">
            {shippingLabel}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {shippingCents === 0
              ? t('checkout.free')
              : formatPrice(shippingCents, currency, locale)}
          </p>
        </div>
      </div>

      {/* Payment */}
      <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {t('checkout.steps.payment')}
        </h3>
        <p className="text-sm text-gray-900 dark:text-white">{paymentLabel}</p>
      </div>

      {/* Line items */}
      <div>
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {t('checkout.items')}
        </h3>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between py-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {line.titleSnapshot}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('checkout.qty')}: {line.quantity}
                </p>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
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
      <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{t('checkout.subtotal')}</span>
          <span>{formatPrice(subtotalCents, currency, locale)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{t('checkout.shipping')}</span>
          <span>
            {shippingCents === 0
              ? t('checkout.free')
              : formatPrice(shippingCents, currency, locale)}
          </span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-bold text-gray-900 dark:border-gray-700 dark:text-white">
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
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page title */}
        <h1 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">
          {t('checkout.title')}
        </h1>

        {/* Step indicator */}
        <StepIndicator currentStep={currentStep} t={t} />

        <div className="lg:grid lg:grid-cols-12 lg:gap-12">
          {/* Main content */}
          <div className="lg:col-span-7">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t(`checkout.steps.${currentStep}`)}
              </h2>
            </div>

            {renderStep()}

            {/* Back link */}
            {backHref && currentStep !== 'review' && (
              <div className="mt-6">
                <Link
                  to={backHref}
                  className="text-sm text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-white"
                >
                  {t('checkout.back')}
                </Link>
              </div>
            )}
            {currentStep === 'review' && backHref && (
              <div className="mt-4">
                <Link
                  to={backHref}
                  className="text-sm text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-white"
                >
                  {t('checkout.back')}
                </Link>
              </div>
            )}
          </div>

          {/* Order summary sidebar */}
          <div className="mt-10 lg:col-span-5 lg:mt-0">
            <div className="lg:sticky lg:top-8">
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
    </div>
  );
}
