import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import prisma from '#/libs/prisma.server';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

import { createPriceList } from '#/core/pricing/index.server';

export async function loader() {
  const groups = await prisma.customerGroup.findMany({
    orderBy: { name: 'asc' },
  });
  return { groups };
}

export async function action({ request }) {
  const formData = await request.formData();
  const name = formData.get('name')?.toString().trim();
  const currency = formData.get('currency')?.toString().trim().toUpperCase();
  const customerGroupId = formData.get('customerGroupId')?.toString() || null;
  const priority = parseInt(formData.get('priority')?.toString() ?? '0', 10);

  if (!name || !currency) {
    return { error: 'Name and currency are required.' };
  }

  await createPriceList({
    name,
    currency,
    customerGroupId: customerGroupId || null,
    priority,
    active: true,
  });

  return redirect('/admin/price-lists');
}

export default function AdminNewPriceListRoute() {
  const { groups } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Price lists', href: '/admin/price-lists' },
              { label: 'New price list' },
            ]}
          />
        }
        title="New price list"
        subtitle="Create group or quantity-specific pricing overrides."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Price list details"
            description="Higher priority lists take precedence when multiple apply."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *" htmlFor="price-list-name">
              <Input
                id="price-list-name"
                name="name"
                required
                placeholder="Wholesale pricing"
              />
            </Field>
            <Field label="Currency *" htmlFor="price-list-currency">
              <Input
                id="price-list-currency"
                name="currency"
                required
                defaultValue="USD"
                maxLength={3}
                className="uppercase"
              />
            </Field>
            <Field label="Customer group" htmlFor="price-list-group">
              <Select
                id="price-list-group"
                name="customerGroupId"
                defaultValue=""
              >
                <option value="">All customers</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" htmlFor="price-list-priority">
              <Input
                id="price-list-priority"
                name="priority"
                type="number"
                defaultValue="0"
              />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/price-lists"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create price list'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
