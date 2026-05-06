import { Form, useNavigation } from 'react-router';

import { useT } from '#/core/i18n/index.js';

export default function AccountProfilePage({ customer }) {
  const t = useT();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {t('account.profile')}
      </h1>

      {/* Update name */}
      <section className="rounded-xl border border-zinc-200 px-6 py-6 dark:border-zinc-700">
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Personal Information
        </h2>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="updateName" />
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Full name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={customer?.name ?? ''}
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {isSaving ? 'Saving…' : t('common.save')}
          </button>
        </Form>
      </section>

      {/* Email (read-only) */}
      <section className="rounded-xl border border-zinc-200 px-6 py-6 dark:border-zinc-700">
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Email Address
        </h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {customer?.email}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          To change your email address, please contact support.
        </p>
      </section>
    </div>
  );
}
