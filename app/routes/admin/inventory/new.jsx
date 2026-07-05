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

import { createLocation } from '#/core/inventory/index.server';

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
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Inventory', href: '/admin/inventory' },
              { label: 'New location' },
            ]}
          />
        }
        title="New inventory location"
        subtitle="Add a warehouse or fulfillment location."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Location details"
            description="Code is a short lowercase identifier used internally."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *" htmlFor="location-name">
              <Input
                id="location-name"
                name="name"
                required
                placeholder="Main warehouse"
              />
            </Field>
            <Field label="Code *" htmlFor="location-code">
              <Input
                id="location-code"
                name="code"
                required
                placeholder="main"
              />
            </Field>
            <Field label="Store pickup (BOPIS)" htmlFor="allows-pickup">
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="allows-pickup"
                  name="allowsPickup"
                  type="checkbox"
                  className="h-4 w-4 rounded border-stone-300"
                />
                Allow customers to pick up orders at this location
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
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create location'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
