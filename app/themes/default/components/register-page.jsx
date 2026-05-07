import { useState } from 'react';
import { Link } from 'react-router';

import { customerAuthClient } from '#/libs/auth/customer-client';

import { useT } from '#/core/i18n/index.js';

export default function RegisterPage({ error: propError }) {
  const t = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(propError ?? null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authError } = await customerAuthClient.signUp.email({
      email,
      password,
      name,
      callbackURL: '/account',
    });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? 'Registration failed. Please try again.');
    } else {
      setSuccess(true);
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
            {t('auth.signUp')}
          </h1>
        </div>

        {success ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-6 text-center dark:border-green-800 dark:bg-green-950">
            <p className="font-medium text-green-800 dark:text-green-200">
              Account created!
            </p>
            <p className="mt-2 text-sm text-green-700 dark:text-green-300">
              Check your email to verify your account.
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
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {t('auth.name')}
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
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
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {t('auth.password')}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              {loading ? t('common.loading') : t('auth.signUp')}
            </button>

            <p className="mt-4 text-center text-sm text-zinc-500">
              {t('auth.hasAccount')}{' '}
              <Link
                to="/account/login"
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                {t('auth.signIn')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
