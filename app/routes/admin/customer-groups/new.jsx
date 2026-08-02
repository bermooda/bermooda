import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import { useT } from '#/core/i18n';
import { createCustomerGroup } from '#/core/pricing/index.server';
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
  const handle = formData.get('handle')?.toString().trim().toLowerCase();

  if (!name || !handle) {
    return { error: 'Name and handle are required.' };
  }

  await createCustomerGroup({ name, handle });
  return redirect('/admin/customer-groups');
}

export default function AdminNewCustomerGroupRoute() {
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
                label: t('admin.customerGroups.new.breadcrumb'),
                href: '/admin/customer-groups',
              },
              { label: t('admin.customerGroups.new.title') },
            ]}
          />
        }
        title={t('admin.customerGroups.new.title')}
        subtitle={t('admin.customerGroups.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.customerGroups.new.cardTitle')}
            description={t('admin.customerGroups.new.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('admin.customerGroups.new.name')}
              htmlFor="group-name"
            >
              <Input
                id="group-name"
                name="name"
                required
                placeholder={t('admin.customerGroups.new.namePlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.customerGroups.new.handle')}
              htmlFor="group-handle"
            >
              <Input
                id="group-handle"
                name="handle"
                required
                placeholder={t('admin.customerGroups.new.handlePlaceholder')}
              />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/customer-groups"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.customerGroups.new.creating')
                : t('admin.customerGroups.new.createButton')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
