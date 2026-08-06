import { UserPlusIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Link, useFetcher } from 'react-router';

import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

/**
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Admin users settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function AdminUsersTab({ data }) {
  const t = useT();
  const roleFetcher = useFetcher();
  const count = data.users.length;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-text text-base font-semibold">
          {t('admin.settings.adminUsers.title')}
        </h2>
      </div>

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {count === 1
              ? t('admin.settings.adminUsers.usersCountOne', { count })
              : t('admin.settings.adminUsers.usersCount', { count })}
          </span>
        </ToolbarGroup>
        <ToolbarGroup>
          <Link
            to="/admin/settings/users/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <UserPlusIcon className="h-4 w-4" />
            {t('admin.settings.adminUsers.invite')}
          </Link>
        </ToolbarGroup>
      </Toolbar>

      {count === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={t('admin.settings.adminUsers.emptyTitle')}
          description={t('admin.settings.adminUsers.emptyDescription')}
          action={
            <Link
              to="/admin/settings/users/new"
              className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
            >
              <UserPlusIcon className="h-4 w-4" />
              {t('admin.settings.adminUsers.invite')}
            </Link>
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.settings.adminUsers.col.name')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.settings.adminUsers.col.role')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.settings.adminUsers.col.verified')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.settings.adminUsers.col.joined')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.settings.adminUsers.col.actions')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {data.users.map((user) => {
              const displayName = user.name || user.email || '—';
              return (
                <Tr key={user.id}>
                  <Td
                    sticky
                    className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                  >
                    <span className="block min-w-0">
                      <span className="block truncate font-medium">
                        {displayName}
                      </span>
                      <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                        {user.email}
                      </span>
                    </span>
                  </Td>
                  <Td sticky className="px-3 py-4">
                    <Badge tone={user.role === 'admin' ? 'accent' : 'neutral'}>
                      {user.role}
                    </Badge>
                  </Td>
                  <Td sticky className="hidden px-3 py-4 sm:table-cell">
                    <Badge tone={user.emailVerified ? 'success' : 'warn'}>
                      {user.emailVerified
                        ? t('admin.settings.adminUsers.verified')
                        : t('admin.settings.adminUsers.pending')}
                    </Badge>
                  </Td>
                  <Td
                    sticky
                    className="hidden px-3 py-4 tabular-nums md:table-cell"
                  >
                    {formatDate(user.createdAt)}
                  </Td>
                  <Td
                    sticky
                    className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                  >
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
                        className="text-accent hover:text-accent-hover disabled:opacity-50"
                        title={
                          user.role === 'admin'
                            ? t('admin.settings.adminUsers.switchToStaff')
                            : t('admin.settings.adminUsers.switchToAdmin')
                        }
                      >
                        {user.role === 'admin'
                          ? t('admin.settings.adminUsers.makeStaff')
                          : t('admin.settings.adminUsers.makeAdmin')}
                        <span className="sr-only">, {displayName}</span>
                      </button>
                    </roleFetcher.Form>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
