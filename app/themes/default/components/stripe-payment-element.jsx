import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

function PaymentForm({ orderNumber, returnUrl }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message ?? 'Payment failed.');
      setProcessing(false);
      return;
    }

    navigate(`/thank-you/${orderNumber}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {processing ? 'Processing…' : 'Pay now'}
      </button>
    </form>
  );
}

/**
 * Embedded Stripe Payment Element for checkout review step.
 */
export default function StripePaymentElement({
  publishableKey,
  clientSecret,
  orderNumber,
}) {
  const [stripePromise, setStripePromise] = useState(null);
  const returnUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/thank-you/${orderNumber}`
      : `/thank-you/${orderNumber}`;

  useEffect(() => {
    if (publishableKey) {
      setStripePromise(loadStripe(publishableKey));
    }
  }, [publishableKey]);

  if (!publishableKey || !clientSecret || !stripePromise) {
    return null;
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: 'stripe' },
      }}
    >
      <PaymentForm orderNumber={orderNumber} returnUrl={returnUrl} />
    </Elements>
  );
}
