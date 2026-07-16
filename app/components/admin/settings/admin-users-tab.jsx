import { UserPlusIcon } from '@heroicons/react/24/outline';
import { Link, useFetcher } from 'react-router';

import Badge from '#/components/admin/badge';
import { SectionCard } from '#/components/admin/settings/shared';
import Table, { TBody, Td, Th, THead } from '#/components/admin/table';

/**
 * Admin users settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function AdminUsersTab({ data }) {
  const roleFetcher = useFetcher();

  return (
    <div className="space-y-6">
      <SectionCard title="Admin Users">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-text-muted text-sm">
            {data.users.length} user{data.users.length !== 1 ? 's' : ''}
          </p>
          <Link
            to="/admin/settings/users/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <UserPlusIcon className="h-4 w-4" />
            Invite admin
          </Link>
        </div>

        {/* Users table */}
        <Table>
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Verified</Th>
              <Th>Joined</Th>
              <Th>Actions</Th>
            </tr>
          </THead>
          <TBody>
            {data.users.length === 0 && (
              <tr>
                <Td colSpan={6} className="py-8 text-center">
                  No admin users found.
                </Td>
              </tr>
            )}
            {data.users.map((user) => (
              <tr key={user.id}>
                <Td className="text-text font-medium">{user.name || '—'}</Td>
                <Td className="text-text">{user.email}</Td>
                <Td>
                  <Badge tone={user.role === 'admin' ? 'accent' : 'neutral'}>
                    {user.role}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={user.emailVerified ? 'success' : 'warn'}>
                    {user.emailVerified ? 'Verified' : 'Pending'}
                  </Badge>
                </Td>
                <Td>
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Td>
                <Td>
                  <roleFetcher.Form method="post" className="inline">
                    <input type="hidden" name="intent" value="change-role" />
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      type="hidden"
                      name="role"
                      value={user.role === 'admin' ? 'staff' : 'admin'}
                    />
                    <button
                      type="submit"
                      disabled={roleFetcher.state !== 'idle'}
                      className="text-accent text-xs hover:underline disabled:opacity-50"
                      title={`Switch to ${user.role === 'admin' ? 'staff' : 'admin'}`}
                    >
                      {user.role === 'admin' ? 'Make staff' : 'Make admin'}
                    </button>
                  </roleFetcher.Form>
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      </SectionCard>
    </div>
  );
}
