import { useState } from 'react';
import { Form, Link, useActionData } from 'react-router';

import config from '#/libs/config';
import { adminAuth } from '#/libs/auth/admin/index.server';
import { useT } from '#/core/i18n';
import AuthLayout from '#/components/auth/auth-layout';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export const handle = {
  htmlClass: 'h-full bg-bg',
  bodyClass: 'h-full',
};

export function meta() {
  return [
    { title: 'Admin — Forgot Password' },
    { name: 'description', content: 'Reset your admin password' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

/**
 * Action — sends a password reset email via the admin auth instance.
 *
 * @param {{ request: Request }} args
 * @returns {Promise<{ error?: string, success?: boolean }>}
 */
export async function action({ request }) {
  const formData = await request.formData();
  const email = formData.get('email');

  if (!email) {
    return { error: 'Email is required' };
  }

  try {
    await adminAuth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${config.baseUrl}/admin/reset-password`,
      },
    });

    // Return success regardless of whether user exists (security)
    return { success: true };
  } catch {
    return { success: true };
  }
}

/**
 * Admin Forgot Password Route
 * @returns {React.ReactElement}
 */
export default function AdminForgotPasswordRoute() {
  const t = useT();
  const actionData = useActionData();
  const [email, setEmail] = useState('');

  if (actionData?.success) {
    return (
      <AuthLayout title={t('admin.auth.forgot.successTitle')}>
        <SuccessAlert message={t('admin.auth.forgot.successMessage')} />
        <div className="mt-6 text-center">
          <Link
            to="/admin/login"
            prefetch="intent"
            className="text-accent text-sm font-medium hover:opacity-80"
          >
            {t('admin.auth.forgot.returnToLogin')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('admin.auth.forgot.title')}
      subtitle={t('admin.auth.forgot.subtitle')}
    >
      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="text-text block text-sm/6 font-medium"
          >
            {t('admin.auth.forgot.email')}
          </label>
          <div className="mt-2">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="bg-surface text-text border-border placeholder:text-text-muted/70 focus:border-accent focus:ring-accent/40 block w-full rounded-md border px-3 py-1.5 text-base outline-none focus:ring-2 sm:text-sm/6"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div>
          <ButtonSubmit className="w-full">
            {t('admin.auth.forgot.submit')}
          </ButtonSubmit>
        </div>
      </Form>

      <p className="text-text-muted mt-10 text-center text-sm/6">
        {t('admin.auth.forgot.rememberPassword')}{' '}
        <Link
          to="/admin/login"
          prefetch="intent"
          className="text-accent font-semibold hover:opacity-80"
        >
          {t('admin.auth.forgot.loginLink')}
        </Link>
      </p>
    </AuthLayout>
  );
}
