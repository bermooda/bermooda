// app/routes/admin/loyalty/index.jsx

import { Form, useActionData, useLoaderData } from 'react-router';

import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

import {
  getLoyaltyConfig,
  parseLoyaltySettingsInput,
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
    await updateLoyaltySettings(
      parseLoyaltySettingsInput({
        enabled: formData.get('enabled'),
        pointsPerDollar: formData.get('pointsPerDollar'),
        redemptionRateCents: formData.get('redemptionRateCents'),
        referralBonusPoints: formData.get('referralBonusPoints'),
      })
    );
    return { ok: true };
  }

  return { ok: false, error: 'Unknown action.' };
}

export default function AdminLoyaltyRoute() {
  const { config } = useLoaderData();
  const actionData = useActionData();

  return (
    <div>
      <PageHeader
        title="Loyalty & referrals"
        subtitle="Configure points earning, redemption, and referral bonuses."
        className="mb-6"
      />

      <Card className="max-w-lg">
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="save-settings" />
          <label className="text-text flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={config.enabled}
            />
            Enable loyalty program
          </label>
          <Field label="Points per dollar spent">
            <Input
              name="pointsPerDollar"
              type="number"
              min="0"
              defaultValue={config.pointsPerDollar}
            />
          </Field>
          <Field label="Redemption rate (cents per 100 points)">
            <Input
              name="redemptionRateCents"
              type="number"
              min="1"
              defaultValue={config.redemptionRateCents}
            />
          </Field>
          <Field label="Referral bonus points">
            <Input
              name="referralBonusPoints"
              type="number"
              min="0"
              defaultValue={config.referralBonusPoints}
            />
          </Field>

          {actionData?.ok && <SuccessAlert message="Settings saved." />}

          <ButtonSubmit>Save settings</ButtonSubmit>
        </Form>
      </Card>
    </div>
  );
}
