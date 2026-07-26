// app/routes/admin/customer-groups/index.jsx

import { PlusIcon } from '@heroicons/react/24/outline';
import { Link, useLoaderData } from 'react-router';

import { listCustomerGroups } from '#/core/pricing/index.server';
import Card from '#/components/admin/card';
import PageHeader from '#/components/admin/page-header';

export async function loader() {
  const groups = await listCustomerGroups();
  return { groups };
}

export default function AdminCustomerGroupsRoute() {
  const { groups } = useLoaderData();

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
                <Link
                  to={`/admin/customer-groups/${group.id}`}
                  className="text-text hover:text-accent font-medium"
                >
                  {group.name}
                </Link>{' '}
                ({group.handle}) — {group._count.members} members,{' '}
                {group._count.priceLists} price lists
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
