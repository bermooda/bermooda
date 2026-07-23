import { useState } from 'react';
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useSearchParams,
} from 'react-router';

import { adminAuth } from '#/libs/auth/admin/index.server';
import AuthLayout from '#/components/auth/auth-layout';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export const handle = {
  htmlClass: 'h-full bg-bg',
  bodyClass: 'h-full',
};

export function meta() {
  return [
    { title: 'Admin — Reset Password' },
    { name: 'description', content: 'Set a new admin password' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

/**
 * Loader — validates the reset token is present.
 */
export async function loader({ request }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return { error: 'Invalid or missing token' };
  }

  return null;
}

/**
 * Action — resets the admin user password via Better Auth.
 */
export async function action({ request }) {
  const formData = await request.formData();
  const token = formData.get('token');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  if (!token || !password || !confirmPassword) {
    return { error: 'All fields are required' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  try {
    const result = await adminAuth.api.resetPassword({
      body: { token, newPassword: password },
    });

    if (!result?.status) {
      return { error: 'Invalid or expired token' };
    }

    return { success: true };
  } catch (error) {
    if (error?.body?.code === 'PASSWORD_TOO_SHORT') {
      return { error: 'Password must be at least 8 characters long' };
    }

    console.error('Admin password reset error:', error);
    return { error: 'Something went wrong. Please try again.' };
  }
}

/**
 * Admin Reset Password Route
 * @returns {React.ReactElement}
 */
export default function AdminResetPasswordRoute() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [searchParams] = useSearchParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const token = searchParams.get('token');

  const handleSubmit = (e) => {
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

  if (actionData?.success) {
    return (
      <AuthLayout title="Password Reset Successful">
        <SuccessAlert message="Your password has been successfully reset. You can now log in with your new password." />
        <div className="mt-6 text-center">
          <Link
            to="/admin/login"
            prefetch="intent"
            className="text-accent text-sm font-medium hover:opacity-80"
          >
            Go to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const error = loaderData?.error || actionData?.error;
  if (error) {
    return (
      <AuthLayout title="Password Reset Failed">
        <ErrorAlert
          message={`${error}. Please try requesting a new password reset link.`}
        />
        <div className="mt-6 text-center">
          <Link
            to="/admin/forgot-password"
            prefetch="intent"
            className="text-accent text-sm font-medium hover:opacity-80"
          >
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set new admin password"
      subtitle="Enter your new password below."
    >
      <Form method="post" onSubmit={handleSubmit}>
        <input type="hidden" name="token" value={token} />
        <div className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="text-text block text-sm leading-6 font-medium"
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
                className="bg-surface text-text border-border placeholder:text-text-muted/70 focus:border-accent focus:ring-accent/40 block w-full rounded-md border px-3 py-1.5 text-base outline-none focus:ring-2 sm:text-sm/6"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="text-text block text-sm leading-6 font-medium"
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
                className="bg-surface text-text border-border placeholder:text-text-muted/70 focus:border-accent focus:ring-accent/40 block w-full rounded-md border px-3 py-1.5 text-base outline-none focus:ring-2 sm:text-sm/6"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {passwordError && (
            <p className="text-danger text-sm">{passwordError}</p>
          )}
        </div>

        <div className="mt-6">
          <ButtonSubmit className="w-full">Reset Password</ButtonSubmit>
        </div>
      </Form>
    </AuthLayout>
  );
}
