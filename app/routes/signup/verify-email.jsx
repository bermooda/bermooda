import { Form, redirect, useSearchParams } from 'react-router';

import config from '#/config';
import { auth } from '#/libs/auth/index.server';
import { ButtonSubmit } from '#/components/ui/button';

export const handle = {
  htmlClass: 'h-full bg-white',
  bodyClass: 'h-full',
};

export function meta() {
  return [
    { title: 'Verify Your Email' },
    { name: 'description', content: 'Please verify your email address' },
  ];
}

// Loader function to check authentication and verification status
export async function loader({ request }) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // If user is already verified, redirect to dashboard
    if (session?.user?.emailVerified) {
      return redirect(config.auth.callbackUrl);
    }

    return null;
  } catch (error) {
    console.error('Email verification loader error:', error);
  }
}

// Action function to handle resend verification email
export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  // Get search params from the request URL
  const url = new URL(request.url);
  const email = url.searchParams.get('email');

  if (intent !== 'resend' || !email) {
    return redirect('/signup/verify-email?error=Invalid+request');
  }

  try {
    // Use Better Auth to send verification email
    await auth.api.sendVerificationEmail({
      body: {
        email,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error resending verification email:', error);
    return redirect(
      '/signup/verify-email?error=Failed+to+resend+verification+email'
    );
  }
}

// Verification email page component
export default function VerifyEmailPage({ actionData }) {
  const [searchParams] = useSearchParams();
  const errorMessage = searchParams.get('error');

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <h2 className="mt-6 text-center text-2xl leading-9 font-bold tracking-tight text-gray-900">
              Please verify your email
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              We&apos;ve sent a verification email to your inbox. Please click
              the verification link in the email to activate your account.
            </p>

            <div className="mt-10">
              <div className="relative">
                <div
                  className="absolute inset-0 flex items-center"
                  aria-hidden="true"
                >
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm leading-6 font-medium">
                  <span className="bg-white px-6 text-gray-900">
                    Didn&apos;t receive the email?
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <Form method="post" className="space-y-6">
                  <input type="hidden" name="intent" value="resend" />
                  <ButtonSubmit className="w-full">
                    Resend verification email
                  </ButtonSubmit>

                  {errorMessage && (
                    <div className="mt-2 text-sm text-red-600">
                      {errorMessage}
                    </div>
                  )}

                  {actionData?.success && (
                    <div className="mt-2 text-sm text-green-600">
                      Verification email sent!
                    </div>
                  )}
                </Form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
