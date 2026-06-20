// app/routes/admin/loyalty/index.jsx

import { Form, useLoaderData } from 'react-router';

import {
  getLoyaltyConfig,
  updateLoyaltySettings,
} from '#/core/loyalty/index.server';

export async function loader() {
  const config = await getLoyaltyConfig();
  return { config };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'save-settings') {
    await updateLoyaltySettings({
      enabled: formData.get('enabled') === 'on',
      pointsPerDollar: parseInt(
        formData.get('pointsPerDollar')?.toString() ?? '1',
        10
      ),
      redemptionRateCents: parseInt(
        formData.get('redemptionRateCents')?.toString() ?? '100',
        10
      ),
      referralBonusPoints: parseInt(
        formData.get('referralBonusPoints')?.toString() ?? '500',
        10
      ),
    });
    return { ok: true };
  }

  return { ok: false, error: 'Unknown action.' };
}

export default function AdminLoyaltyRoute() {
  const { config } = useLoaderData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Loyalty & referrals
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure points earning, redemption, and referral bonuses.
        </p>
      </div>

      <Form
        method="post"
        className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
      >
        <input type="hidden" name="intent" value="save-settings" />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={config.enabled}
          />
          Enable loyalty program
        </label>
        <label className="block text-sm">
          Points per dollar spent
          <input
            name="pointsPerDollar"
            type="number"
            min="0"
            defaultValue={config.pointsPerDollar}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <label className="block text-sm">
          Redemption rate (cents per 100 points)
          <input
            name="redemptionRateCents"
            type="number"
            min="1"
            defaultValue={config.redemptionRateCents}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <label className="block text-sm">
          Referral bonus points
          <input
            name="referralBonusPoints"
            type="number"
            min="0"
            defaultValue={config.referralBonusPoints}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          Save settings
        </button>
      </Form>
    </div>
  );
}
