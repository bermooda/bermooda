import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { authClient } from '#/libs/auth/client';
import { redirectValidSession } from '#/libs/auth/index.server';
import AuthLayout from '#/components/auth/auth-layout';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export const handle = {
  htmlClass: 'h-full bg-white',
  bodyClass: 'h-full',
};

export function meta() {
  return [
    { title: 'Sign Up' },
    { name: 'description', content: 'Create a new account' },
  ];
}

export async function loader({ request }) {
  await redirectValidSession(request);
  return null;
}

export default function SignupRoute() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const onEmailSignUp = async (event) => {
    event.preventDefault();

    setIsLoading(true);
    setErrorMessage('');

    const { error } = await authClient.signUp.email({
      email,
      password,
      name,
    });

    if (error) {
      let message = error?.message || 'Something went wrong. Please try again.';
      if (error?.code === 'PASSWORD_TOO_SHORT') {
        message = 'Password must be at least 8 characters long';
      }
      setErrorMessage(message);
    } else {
      // Redirect to email verification page
      navigate(`/signup/verify-email?email=${encodeURIComponent(email)}`, {
        replace: true,
      });
      return;
    }

    setIsLoading(false);
  };

  return (
    <AuthLayout title="Create a new account">
      <ErrorAlert message={errorMessage} />

      <form onSubmit={onEmailSignUp} className="space-y-6">
        <div>
          <label
            htmlFor="name"
            className="dark:text-dark-300 block text-sm/6 font-medium text-gray-900"
          >
            Full Name
          </label>
          <div className="mt-2">
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              className="dark:bg-dark-800 dark:text-dark-300 dark:outline-dark-600 dark:placeholder:text-dark-500 dark:focus:outline-accent-violet block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </div>

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
          </div>
          <div className="mt-2">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
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
            {isLoading ? 'Creating account...' : 'Create account'}
          </ButtonSubmit>
        </div>
      </form>

      <p className="dark:text-dark-500 mt-10 text-center text-sm/6 text-gray-500">
        Already have an account?{' '}
        <Link
          to="/login"
          prefetch="intent"
          className="dark:text-accent-fuchsia dark:hover:text-accent-violet font-semibold text-indigo-600 hover:text-indigo-500"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
