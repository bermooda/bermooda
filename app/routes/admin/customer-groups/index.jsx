// app/routes/admin/customer-groups/index.jsx

import { PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';
import Card from '#/components/admin/card';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

import {
  addCustomerToGroup,
  listCustomerGroups,
  removeCustomerFromGroup,
} from '#/core/pricing/index.server';

export async function loader() {
  const [groups, customers] = await Promise.all([
    listCustomerGroups(),
    prisma.customer.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true },
    }),
  ]);

  const memberships = await prisma.customerGroupMember.findMany({
    include: {
      customer: { select: { id: true, email: true, name: true } },
      group: { select: { id: true, name: true } },
    },
  });

  return { groups, customers, memberships };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'add-member') {
    const customerGroupId = formData.get('customerGroupId')?.toString();
    const customerId = formData.get('customerId')?.toString();
    if (!customerGroupId || !customerId) {
      return { ok: false, error: 'Group and customer are required.' };
    }
    await addCustomerToGroup(customerGroupId, customerId);
    return { ok: true };
  }

  if (intent === 'remove-member') {
    const customerGroupId = formData.get('customerGroupId')?.toString();
    const customerId = formData.get('customerId')?.toString();
    if (!customerGroupId || !customerId) {
      return { ok: false, error: 'Missing membership.' };
    }
    await removeCustomerFromGroup(customerGroupId, customerId);
    return { ok: true };
  }

  return { ok: false, error: 'Unknown action.' };
}

export default function AdminCustomerGroupsRoute() {
  const { groups, customers, memberships } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="Customer groups"
        subtitle="B2B groups for price list targeting."
        actions={
          <Link
            to="/admin/customer-groups/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            New group
          </Link>
        }
        className="mb-6"
      />

      <div className="space-y-6">
        <Card>
          <h2 className="text-text text-lg font-semibold">Groups</h2>
          <ul className="text-text-muted mt-3 space-y-2 text-sm">
            {groups.length === 0 ? (
              <li>
                No groups yet.{' '}
                <Link
                  to="/admin/customer-groups/new"
                  className="text-accent hover:underline"
                >
                  Create your first group
                </Link>
                .
              </li>
            ) : (
              groups.map((group) => (
                <li key={group.id}>
                  {group.name} ({group.handle}) — {group._count.members}{' '}
                  members, {group._count.priceLists} price lists
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <h2 className="text-text text-lg font-semibold">Add member</h2>
          <Form method="post" className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="intent" value="add-member" />
            <Select name="customerGroupId" className="w-auto">
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
            <Select name="customerId" className="w-auto">
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.email}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="primary">
              Add
            </Button>
          </Form>

          <ul className="text-text mt-4 space-y-2 text-sm">
            {memberships.map((row) => (
              <li key={row.id} className="flex items-center gap-3">
                <span>
                  {row.customer.email} → {row.group.name}
                </span>
                <Form method="post">
                  <input type="hidden" name="intent" value="remove-member" />
                  <input
                    type="hidden"
                    name="customerGroupId"
                    value={row.customerGroupId}
                  />
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
        </Card>
      </div>
    </div>
  );
}
