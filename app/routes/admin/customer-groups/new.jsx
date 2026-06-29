import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

import { createCustomerGroup } from '#/core/pricing/index.server';

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
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Customer groups', href: '/admin/customer-groups' },
              { label: 'New group' },
            ]}
          />
        }
        title="New customer group"
        subtitle="Create a B2B group for price list targeting."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Group details"
            description="Handle is a unique lowercase identifier."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *" htmlFor="group-name">
              <Input
                id="group-name"
                name="name"
                required
                placeholder="Wholesale customers"
              />
            </Field>
            <Field label="Handle *" htmlFor="group-handle">
              <Input
                id="group-handle"
                name="handle"
                required
                placeholder="wholesale"
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
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create group'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
