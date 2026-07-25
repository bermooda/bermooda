import { useState } from 'react';
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useSearchParams,
} from 'react-router';

import config from '#bermooda.config';
import logger from '#/utils/logger.server';
import { adminAuthClient } from '#/libs/auth/admin-client';
import { adminAuth } from '#/libs/auth/admin/index.server';
import {
  createFirstAdmin,
  mapOnboardingActionError,
  parseOnboardingFormData,
  resolveAdminEntryMode,
} from '#/core/admin-onboarding/index.server';
import AuthLayout from '#/components/auth/auth-layout';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export const handle = {
  htmlClass: 'h-full bg-bg',
  bodyClass: 'h-full',
};

export function meta() {
  return [
    { title: 'Admin' },
    { name: 'description', content: 'Admin panel entry' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

// ---------------------------------------------------------------------------
// Loader — branches: authenticated → dashboard, no admins → onboarding, else → login
// ---------------------------------------------------------------------------

export async function loader({ request }) {
  const session = await adminAuth.api.getSession({ headers: request.headers });
  if (session?.user) {
    return redirect('/admin/dashboard', 302);
  }

  const onboardingAvailable = await resolveAdminEntryMode();
  return { mode: onboardingAvailable };
}

// ---------------------------------------------------------------------------
// Action — handles onboarding form POST only
// ---------------------------------------------------------------------------

export async function action({ request }) {
  const formData = await request.formData();
  const { intent, name, email, password, confirmPassword } =
    parseOnboardingFormData(formData);

  if (intent !== 'onboard') {
    return data({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    await createFirstAdmin({ name, email, password, confirmPassword });
    return redirect('/admin?onboarded=1', 302);
  } catch (error) {
    if (error instanceof Response) throw error;

    const mapped = mapOnboardingActionError(error, { name, email });
    if (mapped) {
      return data(mapped.body, { status: mapped.status });
    }

    logger.error({ err: error }, 'Admin onboarding action error');
    return data(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Login form (client-side Better Auth SDK)
// ---------------------------------------------------------------------------

function LoginForm({ onboarded }) {
  const [searchParams] = useSearchParams();
  const rawReturnTo = searchParams.get('returnTo') || '';
  const returnTo = rawReturnTo.startsWith('/admin')
    ? rawReturnTo
    : config.auth.adminCallbackUrl;
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
      {onboarded && (
        <SuccessAlert message="Admin account created. Sign in to continue." />
      )}
      <ErrorAlert message={errorMessage} />

      <form onSubmit={onEmailSignIn} className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="text-text block text-sm/6 font-medium"
          >
            Email address
          </label>
          <div className="mt-2">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="bg-surface text-text border-border placeholder:text-text-muted/70 focus:border-accent focus:ring-accent/40 block w-full rounded-md border px-3 py-1.5 text-base outline-none focus:ring-2 sm:text-sm/6"
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
              className="text-text block text-sm/6 font-medium"
            >
              Password
            </label>
            <div className="text-sm">
              <Link
                to="/admin/forgot-password"
                prefetch="intent"
                className="text-accent font-semibold hover:opacity-80"
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
              className="bg-surface text-text border-border placeholder:text-text-muted/70 focus:border-accent focus:ring-accent/40 block w-full rounded-md border px-3 py-1.5 text-base outline-none focus:ring-2 sm:text-sm/6"
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

// ---------------------------------------------------------------------------
// Onboarding form (server action)
// ---------------------------------------------------------------------------

function OnboardingForm() {
  const actionData = useActionData();
  const fieldErrors = actionData?.fieldErrors ?? {};
  const fields = actionData?.fields ?? {};

  return (
    <AuthLayout
      title="Set up your admin account"
      subtitle="Create the first administrator to get started."
    >
      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <input type="hidden" name="_intent" value="onboard" />

        <div>
          <label
            htmlFor="name"
            className="text-text block text-sm/6 font-medium"
          >
            Full name
          </label>
          <div className="mt-2">
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              defaultValue={fields.name ?? ''}
              required
              className="bg-surface text-text border-border placeholder:text-text-muted/70 focus:border-accent focus:ring-accent/40 block w-full rounded-md border px-3 py-1.5 text-base outline-none focus:ring-2 sm:text-sm/6"
            />
            {fieldErrors.name && (
              <p className="text-danger mt-1 text-sm">{fieldErrors.name}</p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="ob-email"
            className="text-text block text-sm/6 font-medium"
          >
            Email address
          </label>
          <div className="mt-2">
            <input
              id="ob-email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={fields.email ?? ''}
              required
              className="bg-surface text-text border-border placeholder:text-text-muted/70 focus:border-accent focus:ring-accent/40 block w-full rounded-md border px-3 py-1.5 text-base outline-none focus:ring-2 sm:text-sm/6"
            />
            {fieldErrors.email && (
              <p className="text-danger mt-1 text-sm">{fieldErrors.email}</p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="ob-password"
            className="text-text block text-sm/6 font-medium"
          >
            Password
          </label>
          <div className="mt-2">
            <input
              id="ob-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="bg-surface text-text border-border placeholder:text-text-muted/70 focus:border-accent focus:ring-accent/40 block w-full rounded-md border px-3 py-1.5 text-base outline-none focus:ring-2 sm:text-sm/6"
            />
            {fieldErrors.password && (
              <p className="text-danger mt-1 text-sm">{fieldErrors.password}</p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="ob-confirm-password"
            className="text-text block text-sm/6 font-medium"
          >
            Confirm password
          </label>
          <div className="mt-2">
            <input
              id="ob-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="bg-surface text-text border-border placeholder:text-text-muted/70 focus:border-accent focus:ring-accent/40 block w-full rounded-md border px-3 py-1.5 text-base outline-none focus:ring-2 sm:text-sm/6"
            />
            {fieldErrors.confirmPassword && (
              <p className="text-danger mt-1 text-sm">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>
        </div>

        <div>
          <ButtonSubmit className="w-full">Create admin account</ButtonSubmit>
        </div>
      </Form>
    </AuthLayout>
  );
}

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

export default function AdminIndexRoute() {
  const { mode } = useLoaderData();
  const [searchParams] = useSearchParams();
  const onboarded = searchParams.get('onboarded') === '1';

  if (mode === 'onboarding') {
    return <OnboardingForm />;
  }

  return <LoginForm onboarded={onboarded} />;
}
