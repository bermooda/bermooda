// app/routes/admin/customer-groups/index.jsx
// Customer groups admin list — sticky-header table with search.

import { PlusIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { Link, useLoaderData, useNavigate } from 'react-router';

import { useT } from '#/core/i18n';
import { listCustomerGroups } from '#/core/pricing/index.server';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import SearchField from '#/components/admin/search-field';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

export async function loader({ request }) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const groups = await listCustomerGroups();
  const query = q.toLowerCase();
  const filtered = query
    ? groups.filter(
        (group) =>
          group.name.toLowerCase().includes(query) ||
          group.handle.toLowerCase().includes(query)
      )
    : groups;

  return { groups: filtered, total: filtered.length, q };
}

export default function AdminCustomerGroupsRoute() {
  const t = useT();
  const { groups, total, q } = useLoaderData();
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title={t('admin.customerGroups.index.title')}
        subtitle={t('admin.customerGroups.index.subtitle')}
        actions={
          <Link
            to="/admin/customer-groups/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.customerGroups.index.newButton')}
          </Link>
        }
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <SearchField
          defaultValue={q}
          placeholder={t('admin.customerGroups.index.searchPlaceholder')}
          formClassName="w-full sm:max-w-sm"
        />
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.customerGroups.index.resultsOne', { count: total })
              : t('admin.customerGroups.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {groups.length === 0 ? (
        <EmptyState
          icon={UserGroupIcon}
          title={
            q
              ? t('admin.customerGroups.index.emptyTitleSearch')
              : t('admin.customerGroups.index.emptyTitle')
          }
          description={
            q
              ? t('admin.customerGroups.index.emptyDescriptionSearch')
              : t('admin.customerGroups.index.emptyDescription')
          }
          action={
            !q && (
              <Link
                to="/admin/customer-groups/new"
                className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
              >
                <PlusIcon className="h-4 w-4" />
                {t('admin.customerGroups.index.newButton')}
              </Link>
            )
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.customerGroups.index.col.group')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.customerGroups.index.col.members')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.customerGroups.index.col.priceLists')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.customerGroups.index.col.edit')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {groups.map((group) => (
              <Tr
                key={group.id}
                role="link"
                tabIndex={0}
                className="group cursor-pointer"
                onClick={() => navigate(`/admin/customer-groups/${group.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/customer-groups/${group.id}`);
                  }
                }}
              >
                <Td
                  sticky
                  className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                >
                  <span className="block min-w-0">
                    <span className="group-hover:text-accent block truncate font-medium transition-colors">
                      {group.name}
                    </span>
                    <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                      {group.handle}
                    </span>
                  </span>
                </Td>
                <Td sticky className="px-3 py-4 tabular-nums">
                  {group._count.members}
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 tabular-nums sm:table-cell"
                >
                  {group._count.priceLists}
                </Td>
                <Td
                  sticky
                  className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                >
                  <Link
                    to={`/admin/customer-groups/${group.id}`}
                    className="text-accent hover:text-accent-hover"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t('admin.customerGroups.index.edit')}
                    <span className="sr-only">, {group.name}</span>
                  </Link>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
