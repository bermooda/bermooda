import { useState } from 'react';
import { Link } from 'react-router';

import { customerAuthClient } from '#/libs/auth/customer-client';
import { useT } from '#/core/i18n';

import StorefrontShell, {
  STOREFRONT_GREEN as GREEN,
} from './storefront-chrome';

export default function ForgotPasswordPage({ sent: sentProp }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(sentProp ?? false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const redirectTo =
      (typeof window !== 'undefined' ? window.location.origin : '') +
      '/account/reset-password';
    const { error: authError } = await customerAuthClient.forgetPassword({
      email,
      redirectTo,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? 'Failed to send reset email.');
    } else {
      setSent(true);
    }
  }

  return (
    <StorefrontShell>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link
              to="/"
              className="font-serif text-2xl tracking-tight text-stone-900 hover:opacity-80"
            >
              bermooda
            </Link>
            <h1 className="mt-4 font-serif text-3xl font-semibold text-stone-900">
              {t('auth.resetPassword')}
            </h1>
          </div>

          {sent ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-6 py-8 text-center">
              <p className="text-sm text-green-800">
                {t('auth.resetLinkSent')}
              </p>
              <Link
                to="/account/login"
                className="mt-5 inline-block text-sm font-semibold hover:underline"
                style={{ color: GREEN }}
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-stone-200 bg-white px-8 py-8 shadow-lg ring-1 ring-stone-200/70"
            >
              <p className="mb-6 text-sm leading-relaxed text-stone-600">
                Enter your email and we'll send you a password reset link.
              </p>

              {error && (
                <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-semibold text-stone-700"
                >
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:border-stone-700 focus:ring-2 focus:ring-stone-200 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-8 w-full rounded-full px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
                style={{
                  background: GREEN,
                  boxShadow: '0 12px 28px -12px rgba(47,74,58,.45)',
                }}
              >
                {loading ? t('common.loading') : t('auth.sendResetLink')}
              </button>

              <p className="mt-5 text-center text-sm text-stone-600">
                <Link
                  to="/account/login"
                  className="font-semibold hover:underline"
                  style={{ color: GREEN }}
                >
                  Back to Sign In
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </StorefrontShell>
  );
}
