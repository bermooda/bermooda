import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import config from '#/config';
import { authClient } from '#/libs/auth/client';
import { redirectValidSession } from '#/libs/auth/index.server';
import AuthLayout from '#/components/auth/auth-layout';
import GoogleButton from '#/components/auth/google-button';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export const handle = {
  htmlClass: 'h-full bg-white',
  bodyClass: 'h-full',
};

export function meta() {
  return [
    { title: 'Login' },
    { name: 'description', content: 'Login to your account' },
  ];
}

// This loader function checks if user is already logged in
export async function loader({ request }) {
  await redirectValidSession(request);

  // Check for error from Google auth
  const url = new URL(request.url);
  const error = url.searchParams.get('error');

  // Otherwise, render the login page
  return error ? { error } : null;
}

export default function LoginRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || config.auth.callbackUrl;
  const urlError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(urlError || '');

  const onEmailSignIn = async (event) => {
    event.preventDefault();

    setIsLoading(true);
    setErrorMessage('');

    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: returnTo || '/dashboard',
    });

    if (error) {
      if (error?.code === 'EMAIL_NOT_VERIFIED') {
        navigate(`/signup/verify-email?email=${encodeURIComponent(email)}`, {
          replace: true,
        });
        return;
      }

      // Handle other authentication errors
      setErrorMessage(error?.message || 'Invalid email or password');
    }

    setIsLoading(false);
  };

  const onGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');

    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: returnTo || '/dashboard',
    });

    if (error) {
      setErrorMessage(
        error?.message || 'Something went wrong with Google sign-in'
      );
    }
  };

  return (
    <AuthLayout title="Sign in to your account">
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
                to="/forgot-password"
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

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="dark:border-dark-700 w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="dark:text-dark-500 bg-white px-2 text-gray-500 md:bg-zinc-100 dark:bg-transparent">
              Or continue with
            </span>
          </div>
        </div>

        <div className="mt-6">
          <GoogleButton onClick={onGoogleSignIn} isLoading={isLoading} />
        </div>
      </div>

      <p className="dark:text-dark-500 mt-10 text-center text-sm/6 text-gray-500">
        Not a member?{' '}
        <Link
          to="/signup"
          prefetch="intent"
          className="dark:text-accent-fuchsia dark:hover:text-accent-violet font-semibold text-indigo-600 hover:text-indigo-500"
        >
          Create a new account
        </Link>
      </p>
    </AuthLayout>
  );
}
