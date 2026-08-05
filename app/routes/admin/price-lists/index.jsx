// app/routes/admin/price-lists/index.jsx
// Price lists admin list — sticky-header table with search.

import { CurrencyDollarIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Link, useLoaderData, useNavigate } from 'react-router';

import { useT } from '#/core/i18n';
import { listPriceLists } from '#/core/pricing/index.server';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import SearchField from '#/components/admin/search-field';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

export async function loader({ request }) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const priceLists = await listPriceLists();
  const query = q.toLowerCase();
  const filtered = query
    ? priceLists.filter(
        (list) =>
          list.name.toLowerCase().includes(query) ||
          list.currency.toLowerCase().includes(query) ||
          list.customerGroup?.name?.toLowerCase().includes(query)
      )
    : priceLists;

  return { priceLists: filtered, total: filtered.length, q };
}

export default function AdminPriceListsRoute() {
  const t = useT();
  const { priceLists, total, q } = useLoaderData();
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title={t('admin.priceLists.index.title')}
        subtitle={t('admin.priceLists.index.subtitle')}
        actions={
          <Link
            to="/admin/price-lists/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.priceLists.index.newButton')}
          </Link>
        }
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <SearchField
          defaultValue={q}
          placeholder={t('admin.priceLists.index.searchPlaceholder')}
          formClassName="w-full sm:max-w-sm"
        />
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.priceLists.index.resultsOne', { count: total })
              : t('admin.priceLists.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {priceLists.length === 0 ? (
        <EmptyState
          icon={CurrencyDollarIcon}
          title={
            q
              ? t('admin.priceLists.index.emptyTitleSearch')
              : t('admin.priceLists.index.emptyTitle')
          }
          description={
            q
              ? t('admin.priceLists.index.emptyDescriptionSearch')
              : t('admin.priceLists.index.emptyDescription')
          }
          action={
            !q && (
              <Link
                to="/admin/price-lists/new"
                className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
              >
                <PlusIcon className="h-4 w-4" />
                {t('admin.priceLists.index.newButton')}
              </Link>
            )
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.priceLists.index.col.name')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.priceLists.index.col.currency')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.priceLists.index.col.group')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.priceLists.index.col.priority')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 lg:table-cell">
                {t('admin.priceLists.index.col.entries')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.priceLists.index.col.edit')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {priceLists.map((list) => (
              <Tr
                key={list.id}
                role="link"
                tabIndex={0}
                className="group cursor-pointer"
                onClick={() => navigate(`/admin/price-lists/${list.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/price-lists/${list.id}`);
                  }
                }}
              >
                <Td
                  sticky
                  className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                >
                  <span className="group-hover:text-accent block truncate font-medium transition-colors">
                    {list.name}
                  </span>
                </Td>
                <Td sticky className="px-3 py-4">
                  <Badge tone="neutral">{list.currency}</Badge>
                </Td>
                <Td sticky className="hidden px-3 py-4 sm:table-cell">
                  {list.customerGroup ? (
                    <Badge tone="accent">{list.customerGroup.name}</Badge>
                  ) : (
                    <span className="text-text-muted text-xs">—</span>
                  )}
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 tabular-nums md:table-cell"
                >
                  {list.priority}
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 tabular-nums lg:table-cell"
                >
                  {list._count.entries}
                </Td>
                <Td
                  sticky
                  className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                >
                  <Link
                    to={`/admin/price-lists/${list.id}`}
                    className="text-accent hover:text-accent-hover"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t('admin.priceLists.index.edit')}
                    <span className="sr-only">, {list.name}</span>
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
