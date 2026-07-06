import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { customerAuthClient } from '#/libs/auth/customer-client';
import { useT } from '#/core/i18n/index';

import StorefrontShell, {
  STOREFRONT_GREEN as GREEN,
} from '#/themes/default/components/storefront-chrome';

export default function LoginPage({ returnTo, error: propError }) {
  const t = useT();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(propError || null);

  const callbackURL = returnTo || '/account';

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await customerAuthClient.signIn.email({
      email,
      password,
      callbackURL,
    });

    if (authError) {
      setError(authError.message || t('common.error'));
      setLoading(false);
      return;
    }

    navigate(callbackURL);
  }

  return (
    <StorefrontShell>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-lg ring-1 ring-stone-200/70">
          <div className="mb-8 text-center">
            <Link
              to="/"
              className="font-serif text-2xl tracking-tight text-stone-900 hover:opacity-80"
            >
              bermooda
            </Link>
          </div>

          <h1 className="mb-6 font-serif text-2xl font-semibold text-stone-900">
            {t('auth.signIn')}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-700 focus:ring-2 focus:ring-stone-200 focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-stone-700"
                >
                  {t('auth.password')}
                </label>
                <Link
                  to="/account/forgot-password"
                  className="text-xs font-medium text-stone-500 hover:text-stone-800"
                  style={{ color: GREEN }}
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-700 focus:ring-2 focus:ring-stone-200 focus:outline-none"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: GREEN,
                boxShadow: '0 12px 28px -12px rgba(47,74,58,.45)',
              }}
            >
              {loading ? t('common.loading') : t('auth.signIn')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-600">
            {t('auth.noAccount')}{' '}
            <Link
              to="/account/register"
              className="font-semibold hover:underline"
              style={{ color: GREEN }}
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </StorefrontShell>
  );
}
