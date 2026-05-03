import { useState } from 'react';
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useSearchParams,
} from 'react-router';

import { auth } from '#/libs/auth/index.server';
import AuthLayout from '#/components/auth/auth-layout';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export const handle = {
  htmlClass: 'h-full bg-white',
  bodyClass: 'h-full',
};

export function meta() {
  return [
    { title: 'Reset Password' },
    { name: 'description', content: 'Reset your password' },
  ];
}

/**
 * Checks for errors in the form data
 *
 * @param {string} token Token
 * @param {string} password Password
 * @param {string} confirmPassword Confirm password
 */
function hasFieldErrors(token, password, confirmPassword) {
  if (!token || !password || !confirmPassword) {
    return { error: 'All fields are required' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  return null;
}

// This loader function verifies the token
export async function loader({ request }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return { error: 'Invalid or missing token' };
  }

  // Better Auth will handle token validation during the reset action
  return null;
}

// This action function handles form submission
export async function action({ request }) {
  const formData = await request.formData();
  const token = formData.get('token');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  const fieldError = hasFieldErrors(token, password, confirmPassword);
  if (fieldError) {
    return fieldError;
  }

  try {
    const result = await auth.api.resetPassword({
      body: {
        token,
        newPassword: password,
      },
    });

    if (!result.status) {
      return { error: 'Invalid or expired token' };
    }

    return { success: true };
  } catch (error) {
    if (error.body.code === 'PASSWORD_TOO_SHORT') {
      return { error: 'Password must be at least 8 characters long' };
    }

    console.error('Password reset error:', error);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export default function ResetPasswordRoute() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [searchParams] = useSearchParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const token = searchParams.get('token');

  // Handle form submission
  const handleSubmit = (e) => {
    // Client-side validation
    if (password !== confirmPassword) {
      e.preventDefault();
      setPasswordError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      e.preventDefault();
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    setPasswordError('');
  };

  // Show success message if password was reset
  if (actionData?.success) {
    return (
      <AuthLayout title="Password Reset Successful">
        <SuccessAlert message="Your password has been successfully reset. You can now log in with your new password." />
        <div className="mt-6 text-center">
          <Link
            to="/login"
            prefetch="intent"
            className="dark:text-accent-fuchsia dark:hover:text-accent-violet text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Go to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // Show error message if token is invalid
  const error = loaderData?.error || actionData?.error;
  if (error) {
    return (
      <AuthLayout title="Password Reset Failed">
        <ErrorAlert
          message={`${error}. Please try requesting a new password reset link.`}
        />
        <div className="mt-6 text-center">
          <Link
            to="/forgot-password"
            prefetch="intent"
            className="dark:text-accent-fuchsia dark:hover:text-accent-violet text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your new password below."
    >
      <Form method="post" onSubmit={handleSubmit}>
        <input type="hidden" name="token" value={token} />
        <div className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="dark:text-dark-300 block text-sm leading-6 font-medium text-gray-900"
            >
              New Password
            </label>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="dark:bg-dark-800 dark:text-dark-300 dark:outline-dark-600 dark:placeholder:text-dark-500 dark:focus:outline-accent-violet block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="dark:text-dark-300 block text-sm leading-6 font-medium text-gray-900"
            >
              Confirm Password
            </label>
            <div className="mt-2">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="dark:bg-dark-800 dark:text-dark-300 dark:outline-dark-600 dark:placeholder:text-dark-500 dark:focus:outline-accent-violet block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {passwordError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {passwordError}
            </p>
          )}
        </div>

        <div className="mt-6">
          <ButtonSubmit className="w-full">Reset Password</ButtonSubmit>
        </div>
      </Form>
    </AuthLayout>
  );
}
