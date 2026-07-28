import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { customerAuthClient } from '#/libs/auth/customer-client';
import { useT } from '#/core/i18n';

import StorefrontShell, {
  STOREFRONT_GREEN as GREEN,
} from './storefront-chrome';

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
      <StorefrontShell>
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-24">
          <div className="text-center">
            <p className="text-stone-600">Invalid or expired reset link.</p>
            <Link
              to="/account/forgot-password"
              className="mt-3 inline-block text-sm font-semibold hover:underline"
              style={{ color: GREEN }}
            >
              Request a new one
            </Link>
          </div>
        </div>
      </StorefrontShell>
    );
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

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-stone-200 bg-white px-8 py-8 shadow-lg ring-1 ring-stone-200/70"
          >
            {error && (
              <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-semibold text-stone-700"
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
                  className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:border-stone-700 focus:ring-2 focus:ring-stone-200 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="confirm"
                  className="mb-1 block text-sm font-semibold text-stone-700"
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
                  className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:border-stone-700 focus:ring-2 focus:ring-stone-200 focus:outline-none"
                />
              </div>
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
              {loading ? t('common.loading') : 'Set New Password'}
            </button>
          </form>
        </div>
      </div>
    </StorefrontShell>
  );
}
