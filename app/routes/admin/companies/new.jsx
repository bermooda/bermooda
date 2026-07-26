import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import { createCompany, parseCreateCompanyForm } from '#/core/b2b/index.server';
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
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Companies', href: '/admin/companies' },
              { label: 'New company' },
            ]}
          />
        }
        title="New company"
        subtitle="Create a B2B company account for shared purchasing."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Company details"
            description="Name is required. Tax ID and net terms are optional."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *" htmlFor="company-name">
              <Input
                id="company-name"
                name="name"
                required
                placeholder="Acme Corp"
              />
            </Field>
            <Field label="Tax ID" htmlFor="company-tax-id">
              <Input id="company-tax-id" name="taxId" placeholder="Optional" />
            </Field>
            <Field label="Net terms (days)" htmlFor="company-net-terms">
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
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create company'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
