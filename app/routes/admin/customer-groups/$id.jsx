import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { listCustomers } from '#/core/customers/index.server';
import {
  addCustomerToGroup,
  getCustomerGroup,
  removeCustomerFromGroup,
} from '#/core/pricing/index.server';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

export async function loader({ params }) {
  const [group, customersResult] = await Promise.all([
    getCustomerGroup(params.id),
    listCustomers({ limit: 100 }),
  ]);

  if (!group) {
    throw new Response('Customer group not found', { status: 404 });
  }

  return { group, customers: customersResult.customers };
}

export async function action({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const customerId = formData.get('customerId')?.toString();

  if (!customerId) {
    return { error: 'Customer is required.' };
  }

  try {
    if (intent === 'add-member') {
      await addCustomerToGroup(params.id, customerId);
      return { ok: true, message: 'Member added.' };
    }

    if (intent === 'remove-member') {
      await removeCustomerFromGroup(params.id, customerId);
      return { ok: true, message: 'Member removed.' };
    }

    return { error: 'Unknown action.' };
  } catch (err) {
    return { error: err.message ?? 'Could not update members.' };
  }
}

export function meta({ loaderData }) {
  const name = loaderData?.group?.name ?? 'Customer group';
  return [{ title: `${name} — Customer groups` }];
}

export default function AdminCustomerGroupDetailRoute() {
  const { group, customers } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';
  const memberIds = new Set(group.members.map((m) => m.customerId));
  const availableCustomers = customers.filter((c) => !memberIds.has(c.id));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Customer groups', href: '/admin/customer-groups' },
              { label: group.name },
            ]}
          />
        }
        title={group.name}
        subtitle={`Handle: ${group.handle} · ${group._count.members} members · ${group._count.priceLists} price lists`}
        actions={
          <Button as={Link} to="/admin/customer-groups" variant="secondary">
            Back
          </Button>
        }
      />

      <ErrorAlert message={actionData?.error} />
      {actionData?.ok && <SuccessAlert message={actionData.message} />}

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader
            title="Members"
            description="Add or remove customers in this group."
          />

          {group.members.length === 0 ? (
            <p className="text-text-muted mb-4 text-sm">No members yet.</p>
          ) : (
            <ul className="divide-border mb-4 divide-y text-sm">
              {group.members.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-text">{row.customer.email}</span>
                  <Form method="post">
                    <input type="hidden" name="intent" value="remove-member" />
                    <input
                      type="hidden"
                      name="customerId"
                      value={row.customerId}
                    />
                    <Button type="submit" variant="secondary">
                      Remove
                    </Button>
                  </Form>
                </li>
              ))}
            </ul>
          )}

          <Form method="post" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="intent" value="add-member" />
            <Field label="Customer" htmlFor="group-customer" className="flex-1">
              <Select
                id="group-customer"
                name="customerId"
                required
                disabled={availableCustomers.length === 0}
              >
                <option value="">
                  {availableCustomers.length === 0
                    ? 'No customers available'
                    : 'Select customer…'}
                </option>
                {availableCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.email}
                  </option>
                ))}
              </Select>
            </Field>
            <ButtonSubmit
              disabled={isSaving || availableCustomers.length === 0}
            >
              {isSaving ? 'Adding…' : 'Add member'}
            </ButtonSubmit>
          </Form>
        </Card>

        <ActionBar>
          <span />
          <Link
            to="/admin/customer-groups"
            className="text-text-muted hover:text-text text-sm transition-colors"
          >
            Back to groups
          </Link>
        </ActionBar>
      </div>
    </div>
  );
}
