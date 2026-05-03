import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useOutletContext,
} from 'react-router';

import { auth, authContext } from '#/libs/auth/index.server';
import { handleError } from '#/libs/error.server';
import prisma from '#/libs/prisma.server';
import useToaster from '#/hooks/use-toaster';
import { ButtonSubmit } from '#/components/ui/button';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

async function isGoogleSocialUser(userId) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      providerId: 'google',
    },
    select: {
      id: true,
    },
  });

  return Boolean(account);
}

export function meta() {
  return [
    { title: 'Settings - Your Account' },
    { name: 'description', content: 'Manage your account settings' },
  ];
}

export async function loader({ context }) {
  const user = context.get(authContext);

  if (!user) {
    return redirect('/login');
  }

  const googleSocialUser = await isGoogleSocialUser(user.id);

  return {
    canEditEmail: !googleSocialUser,
  };
}

/**
 * Update user settings in the database
 *
 * @param {Object} params - Action parameters
 * @param {Object} params.context - Context from middleware
 * @param {Request} params.request - Request object
 * @returns {Promise<Object>} Success or error result
 */
export async function action({ context, request }) {
  try {
    // Get the authenticated user from context
    const user = context.get(authContext);

    if (!user) {
      return redirect('/login');
    }

    // Parse form data
    const formData = await request.formData();
    const name = String(formData.get('name') || '').trim();
    const emailInput = formData.get('email');
    const email = normalizeEmail(emailInput === null ? user.email : emailInput);
    const currentEmail = normalizeEmail(user.email);

    if (!email) {
      return { success: false, error: 'Email is required' };
    }

    if (!EMAIL_PATTERN.test(email)) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    const canEditEmail = !(await isGoogleSocialUser(user.id));
    const emailChanged = email !== currentEmail;
    const nameChanged = name !== (user.name || '');

    if (!emailChanged && !nameChanged) {
      return { success: true, message: 'No changes to save' };
    }

    if (emailChanged && !canEditEmail) {
      if (nameChanged) {
        await prisma.user.update({
          where: { id: user.id },
          data: { name },
        });

        return {
          success: true,
          message:
            'Name updated. Email changes are not available for Google sign-in accounts.',
        };
      }

      return {
        success: false,
        error:
          'Email changes are not available for accounts signed in with Google.',
      };
    }

    if (emailChanged) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          id: { not: user.id },
        },
        select: {
          id: true,
        },
      });

      if (existingUser) {
        return {
          success: false,
          error: 'This email address is already in use.',
        };
      }

      await auth.api.changeEmail({
        body: {
          newEmail: email,
        },
        headers: request.headers,
      });
    }

    if (nameChanged) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
        },
      });
    }

    if (emailChanged && nameChanged) {
      return {
        success: true,
        message:
          'Name updated. Check your new email address to verify the email change.',
      };
    }

    if (emailChanged) {
      return {
        success: true,
        message: 'Check your new email address to verify the email change.',
      };
    }

    return { success: true, message: 'Settings updated successfully' };
  } catch (error) {
    return handleError(error, {
      message: 'Error updating user settings',
      source: 'routes/user/settings action',
      userMessage: 'Failed to update settings',
    });
  }
}

/**
 * Settings Route Component
 *
 * @returns {React.ReactNode}
 */
export default function SettingsRoute() {
  const actionData = useActionData();
  const { canEditEmail } = useLoaderData();

  useToaster(actionData);

  /** @type {{user?: import('../../../prisma/generated/models/User').UserModel}} */
  const data = useOutletContext() || {};

  const [formData, setFormData] = useState({
    name: data.user?.name || '',
    email: data.user?.email || '',
  });

  useEffect(() => {
    setFormData({
      name: data.user?.name || '',
      email: data.user?.email || '',
    });
  }, [data.user?.name, data.user?.email]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const onClickReset = () => {
    setFormData({
      name: data.user?.name || '',
      email: data.user?.email || '',
    });
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Form method="post" className="mx-auto max-w-4xl">
        <div className="flex items-center space-x-2">
          <Cog6ToothIcon className="h-8 w-8" />
          <h1 className="text-2xl/8 font-semibold text-zinc-950 sm:text-xl/8 dark:text-white">
            Settings
          </h1>
        </div>
        <hr
          role="presentation"
          className="my-10 mt-6 w-full border-t border-zinc-950/10 dark:border-white/10"
        />
        <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <div className="space-y-1">
            <h2 className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white">
              Full Name
            </h2>
            <p
              data-slot="text"
              className="text-base/6 text-zinc-500 sm:text-sm/6 dark:text-zinc-400"
            >
              This will be displayed on your public profile.
            </p>
          </div>
          <div>
            <span
              data-slot="control"
              className="relative block w-full before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none has-data-invalid:before:shadow-red-500/10 sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500 dark:before:hidden"
            >
              <input
                aria-label="Full Name"
                className="relative block w-full appearance-none rounded-lg border border-zinc-950/10 bg-transparent px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] text-base/6 text-zinc-950 placeholder:text-zinc-500 focus:outline-hidden data-disabled:border-zinc-950/20 data-hover:border-zinc-950/20 data-invalid:border-red-500 data-invalid:data-hover:border-red-500 sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6 dark:border-white/10 dark:bg-white/5 dark:text-white dark:scheme-dark dark:data-disabled:border-white/15 dark:data-disabled:bg-white/2.5 dark:data-hover:border-white/20 dark:data-hover:data-disabled:border-white/15 dark:data-invalid:border-red-500 dark:data-invalid:data-hover:border-red-500"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
              />
            </span>
          </div>
        </section>
        <hr
          role="presentation"
          className="my-10 w-full border-t border-zinc-950/5 dark:border-white/5"
        />
        <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <div className="space-y-1">
            <h2 className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white">
              Email
            </h2>
            <p
              data-slot="text"
              className="text-base/6 text-zinc-500 sm:text-sm/6 dark:text-zinc-400"
            >
              Your account email address.
            </p>
          </div>
          <div>
            <span
              data-slot="control"
              className="relative block w-full before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none has-data-invalid:before:shadow-red-500/10 sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500 dark:before:hidden"
            >
              <input
                aria-label="Email"
                className="relative block w-full appearance-none rounded-lg border border-zinc-950/10 bg-transparent px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] text-base/6 text-zinc-950 placeholder:text-zinc-500 focus:outline-hidden data-disabled:border-zinc-950/20 data-hover:border-zinc-950/20 data-invalid:border-red-500 data-invalid:data-hover:border-red-500 sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6 dark:border-white/10 dark:bg-white/5 dark:text-white dark:scheme-dark dark:data-disabled:border-white/15 dark:data-disabled:bg-white/2.5 dark:data-hover:border-white/20 dark:data-hover:data-disabled:border-white/15 dark:data-invalid:border-red-500 dark:data-invalid:data-hover:border-red-500"
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={!canEditEmail}
              />
            </span>
            {!canEditEmail ? (
              <p className="mt-2 text-sm/6 text-amber-600 dark:text-amber-400">
                Email changes are not available for accounts signed in with
                Google.
              </p>
            ) : null}
          </div>
        </section>
        <hr
          role="presentation"
          className="my-10 w-full border-t border-zinc-950/5 dark:border-white/5"
        />
        <div className="flex justify-end gap-4">
          <button
            type="reset"
            className="flex justify-center rounded-md bg-white px-3 py-1.5 text-sm/6 font-semibold text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={onClickReset}
          >
            Reset
          </button>
          <ButtonSubmit className="min-w-32">Save changes</ButtonSubmit>
        </div>
      </Form>
    </div>
  );
}
