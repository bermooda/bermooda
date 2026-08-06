// app/routes/admin/loyalty/index.jsx

import { Form, useActionData, useLoaderData } from 'react-router';

import { useT } from '#/core/i18n';
import {
  getLoyaltyConfig,
  parseLoyaltySettingsInput,
  updateLoyaltySettings,
} from '#/core/loyalty/index.server';
import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

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
  const t = useT();
  const { config } = useLoaderData();
  const actionData = useActionData();

  return (
    <div>
      <PageHeader
        title={t('admin.loyalty.index.title')}
        subtitle={t('admin.loyalty.index.subtitle')}
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
            {t('admin.loyalty.index.enable')}
          </label>
          <Field label={t('admin.loyalty.index.pointsPerDollar')}>
            <Input
              name="pointsPerDollar"
              type="number"
              min="0"
              defaultValue={config.pointsPerDollar}
            />
          </Field>
          <Field label={t('admin.loyalty.index.redemptionRate')}>
            <Input
              name="redemptionRateCents"
              type="number"
              min="1"
              defaultValue={config.redemptionRateCents}
            />
          </Field>
          <Field label={t('admin.loyalty.index.referralBonus')}>
            <Input
              name="referralBonusPoints"
              type="number"
              min="0"
              defaultValue={config.referralBonusPoints}
            />
          </Field>

          {actionData?.ok && (
            <SuccessAlert message={t('admin.loyalty.index.settingsSaved')} />
          )}

          <ButtonSubmit>{t('admin.loyalty.index.saveSettings')}</ButtonSubmit>
        </Form>
      </Card>
    </div>
  );
}
