import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import { useT } from '#/core/i18n';
import { createLocation } from '#/core/inventory/index.server';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function action({ request }) {
  const formData = await request.formData();
  const name = formData.get('name')?.toString().trim();
  const code = formData.get('code')?.toString().trim().toLowerCase();

  if (!name || !code) {
    return { error: 'Name and code are required.' };
  }

  const allowsPickup =
    formData.get('allowsPickup') === 'on' ||
    formData.get('allowsPickup') === 'true';

  await createLocation({ name, code, allowsPickup });

  return redirect('/admin/inventory');
}

export default function AdminNewInventoryLocationRoute() {
  const t = useT();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.inventory.new.breadcrumbInventory'),
                href: '/admin/inventory',
              },
              { label: t('admin.inventory.new.breadcrumbNew') },
            ]}
          />
        }
        title={t('admin.inventory.new.title')}
        subtitle={t('admin.inventory.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.inventory.new.cardTitle')}
            description={t('admin.inventory.new.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('admin.inventory.new.name')}
              htmlFor="location-name"
            >
              <Input
                id="location-name"
                name="name"
                required
                placeholder={t('admin.inventory.new.namePlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.inventory.new.code')}
              htmlFor="location-code"
            >
              <Input
                id="location-code"
                name="code"
                required
                placeholder={t('admin.inventory.new.codePlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.inventory.new.pickup')}
              htmlFor="allows-pickup"
            >
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="allows-pickup"
                  name="allowsPickup"
                  type="checkbox"
                  className="h-4 w-4 rounded border-stone-300"
                />
                {t('admin.inventory.new.pickupLabel')}
              </label>
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/inventory"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.inventory.new.creating')
                : t('admin.inventory.new.create')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
