import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import { createCompany, parseCreateCompanyForm } from '#/core/b2b/index.server';
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

  try {
    const company = await createCompany(parseCreateCompanyForm(formData));
    return redirect(`/admin/companies/${company.id}`);
  } catch (err) {
    return { error: err.message ?? 'Could not create company.' };
  }
}

export function meta() {
  return [{ title: 'New company — Companies' }];
}

export default function AdminNewCompanyRoute() {
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
                label: t('admin.companies.new.breadcrumb'),
                href: '/admin/companies',
              },
              { label: t('admin.companies.new.title') },
            ]}
          />
        }
        title={t('admin.companies.new.title')}
        subtitle={t('admin.companies.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.companies.new.cardTitle')}
            description={t('admin.companies.new.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.companies.new.name')} htmlFor="company-name">
              <Input
                id="company-name"
                name="name"
                required
                placeholder={t('admin.companies.new.namePlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.companies.new.taxId')}
              htmlFor="company-tax-id"
            >
              <Input
                id="company-tax-id"
                name="taxId"
                placeholder={t('admin.companies.new.taxIdPlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.companies.new.netTerms')}
              htmlFor="company-net-terms"
            >
              <Input
                id="company-net-terms"
                name="netTermsDays"
                type="number"
                min="0"
                defaultValue="30"
              />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/companies"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.companies.new.creating')
                : t('admin.companies.new.createButton')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
