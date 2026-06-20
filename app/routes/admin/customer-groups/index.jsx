// app/routes/admin/customer-groups/index.jsx

import { Form, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';

import {
  addCustomerToGroup,
  createCustomerGroup,
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

  if (intent === 'create-group') {
    const name = formData.get('name')?.toString().trim();
    const handle = formData.get('handle')?.toString().trim().toLowerCase();
    if (!name || !handle) {
      return { ok: false, error: 'Name and handle are required.' };
    }
    await createCustomerGroup({ name, handle });
    return { ok: true };
  }

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Customer groups
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          B2B groups for price list targeting.
        </p>
      </div>

      <Form method="post" className="flex flex-wrap gap-3">
        <input type="hidden" name="intent" value="create-group" />
        <input
          name="name"
          placeholder="Group name"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          name="handle"
          placeholder="handle"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          Create group
        </button>
      </Form>

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-medium">Groups</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {groups.map((group) => (
            <li key={group.id}>
              {group.name} ({group.handle}) — {group._count.members} members,{' '}
              {group._count.priceLists} price lists
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-medium">Add member</h2>
        <Form method="post" className="mt-3 flex flex-wrap gap-3">
          <input type="hidden" name="intent" value="add-member" />
          <select
            name="customerGroupId"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <select
            name="customerId"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.email}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            Add
          </button>
        </Form>

        <ul className="mt-4 space-y-2 text-sm">
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
                <input type="hidden" name="customerId" value={row.customerId} />
                <button type="submit" className="text-xs text-red-600">
                  Remove
                </button>
              </Form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
