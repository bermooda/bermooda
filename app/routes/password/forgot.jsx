import { useState } from 'react';
import { Form, Link, useActionData } from 'react-router';

import config from '#/config';
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
    { title: 'Forgot Password' },
    { name: 'description', content: 'Reset your password' },
  ];
}

// This action function handles form submission
export async function action({ request }) {
  const formData = await request.formData();
  const email = formData.get('email');

  if (!email) {
    return { error: 'Email is required' };
  }

  try {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${config.baseUrl}/reset-password`,
      },
    });

    // Return success regardless of whether user exists for security reasons
    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: true }; // Still return success for security reasons
  }
}

export default function ForgotPasswordRoute() {
  const actionData = useActionData();
  const [email, setEmail] = useState('');

  // Show success message if email was sent
  if (actionData?.success) {
    return (
      <AuthLayout title="Check your email">
        <SuccessAlert message="If an account exists with the email you provided, we have sent password reset instructions to that email address." />
        <div className="mt-6 text-center">
          <Link
            to="/login"
            prefetch="intent"
            className="dark:text-accent-fuchsia dark:hover:text-accent-violet text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Return to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email address and we'll send you a link to reset your password."
    >
      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
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
              required
              className="dark:bg-dark-800 dark:text-dark-300 dark:outline-dark-600 dark:placeholder:text-dark-500 dark:focus:outline-accent-violet block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div>
          <ButtonSubmit className="w-full">Send reset link</ButtonSubmit>
        </div>
      </Form>

      <p className="dark:text-dark-500 mt-10 text-center text-sm/6 text-gray-500">
        Remember your password?{' '}
        <Link
          to="/login"
          prefetch="intent"
          className="dark:text-accent-fuchsia dark:hover:text-accent-violet font-semibold text-indigo-600 hover:text-indigo-500"
        >
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}
