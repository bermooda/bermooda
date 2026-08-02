import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import { createCustomer } from '#/core/customers/index.server';
import { useT } from '#/core/i18n';
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
  const email = formData.get('email')?.toString().trim() ?? '';
  const name = formData.get('name')?.toString().trim() || null;
  const phone = formData.get('phone')?.toString().trim() || null;

  if (!email) {
    return { error: 'Email is required.' };
  }

  try {
    const customer = await createCustomer({ email, name, phone });
    return redirect(`/admin/customers/${customer.id}`);
  } catch (err) {
    if (err.code === 'CUSTOMER_EMAIL_EXISTS') {
      return { error: err.message };
    }
    throw err;
  }
}

export default function AdminNewCustomerRoute() {
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
                label: t('admin.customers.new.breadcrumb'),
                href: '/admin/customers',
              },
              { label: t('admin.customers.new.title') },
            ]}
          />
        }
        title={t('admin.customers.new.title')}
        subtitle={t('admin.customers.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.customers.new.cardTitle')}
            description={t('admin.customers.new.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={t('admin.customers.new.email')}
              htmlFor="customer-email"
            >
              <Input
                id="customer-email"
                type="email"
                name="email"
                required
                placeholder={t('admin.customers.new.emailPlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.customers.new.name')}
              htmlFor="customer-name"
            >
              <Input
                id="customer-name"
                type="text"
                name="name"
                placeholder={t('admin.customers.new.namePlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.customers.new.phone')}
              htmlFor="customer-phone"
            >
              <Input
                id="customer-phone"
                type="tel"
                name="phone"
                placeholder={t('admin.customers.new.phonePlaceholder')}
              />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/customers"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.customers.new.creating')
                : t('admin.customers.new.createButton')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
