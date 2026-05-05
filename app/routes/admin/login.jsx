import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import config from '#/config';
import { adminAuthClient } from '#/libs/auth/admin-client';
import AuthLayout from '#/components/auth/auth-layout';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export const handle = {
  htmlClass: 'h-full bg-white',
  bodyClass: 'h-full',
};

export function meta() {
  return [
    { title: 'Admin Login' },
    { name: 'description', content: 'Sign in to the admin panel' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

/**
 * Admin Login Route
 * @returns {React.ReactElement}
 */
export default function AdminLoginRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawReturnTo = searchParams.get('returnTo') || '';
  const returnTo = rawReturnTo.startsWith('/admin') ? rawReturnTo : config.auth.adminCallbackUrl;
  const urlError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(urlError || '');

  const onEmailSignIn = async (event) => {
    event.preventDefault();

    setIsLoading(true);
    setErrorMessage('');

    const { error } = await adminAuthClient.signIn.email({
      email,
      password,
      callbackURL: returnTo,
    });

    if (error) {
      setErrorMessage(error?.message || 'Invalid email or password');
    }

    setIsLoading(false);
  };

  return (
    <AuthLayout title="Admin sign in">
      <ErrorAlert message={errorMessage} />

      <form onSubmit={onEmailSignIn} className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="dark:text-dark-300 block text-sm/6 font-medium text-gray-900"
          >
            Email address
          </label>
          <div className="mt-2">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="dark:bg-dark-800 dark:text-dark-300 dark:outline-dark-600 dark:placeholder:text-dark-500 dark:focus:outline-accent-violet block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="dark:text-dark-300 block text-sm/6 font-medium text-gray-900"
            >
              Password
            </label>
            <div className="text-sm">
              <Link
                to="/admin/forgot-password"
                prefetch="intent"
                className="dark:text-accent-fuchsia dark:hover:text-accent-violet font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          <div className="mt-2">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="dark:bg-dark-800 dark:text-dark-300 dark:outline-dark-600 dark:placeholder:text-dark-500 dark:focus:outline-accent-violet block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div>
          <ButtonSubmit className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </ButtonSubmit>
        </div>
      </form>
    </AuthLayout>
  );
}
