import { useState } from 'react';
import { Link } from 'react-router';

import { customerAuthClient } from '#/libs/auth/customer-client';

import { useT } from '#/core/i18n/index';

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
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            to="/"
            className="text-2xl font-bold text-zinc-900 dark:text-zinc-100"
          >
            bermooda
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {t('auth.resetPassword')}
          </h1>
        </div>

        {sent ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-6 text-center dark:border-green-800 dark:bg-green-950">
            <p className="text-sm text-green-700 dark:text-green-300">
              {t('auth.resetLinkSent')}
            </p>
            <Link
              to="/account/login"
              className="mt-4 inline-block text-sm font-medium text-green-800 underline dark:text-green-200"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-zinc-200 px-8 py-8 shadow-sm dark:border-zinc-700"
          >
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              Enter your email and we'll send you a password reset link.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            >
              {loading ? t('common.loading') : t('auth.sendResetLink')}
            </button>

            <p className="mt-4 text-center text-sm text-zinc-500">
              <Link
                to="/account/login"
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                Back to Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
