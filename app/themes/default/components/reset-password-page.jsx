import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { customerAuthClient } from '#/libs/auth/customer-client';

import { useT } from '#/core/i18n/index';

export default function ResetPasswordPage({ token, error: propError }) {
  const t = useT();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(propError ?? null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: authError } = await customerAuthClient.resetPassword({
      newPassword: password,
      token,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? 'Password reset failed.');
    } else {
      navigate('/account/login?reset=true');
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <p className="text-zinc-500">Invalid or expired reset link.</p>
          <Link
            to="/account/forgot-password"
            className="mt-2 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            Request a new one
          </Link>
        </div>
      </div>
    );
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

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-zinc-200 px-8 py-8 shadow-sm dark:border-zinc-700"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                {t('auth.newPassword')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label
                htmlFor="confirm"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {loading ? t('common.loading') : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
