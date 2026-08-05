// app/routes/admin/companies/index.jsx
// B2B company accounts list — sticky-header table with search.

import { BuildingOffice2Icon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { parseAdminSearchParams } from '#/libs/api/admin-ui/index.server';
import { loadCompanyAdminIndexData } from '#/core/b2b/index.server';
import { useT } from '#/core/i18n';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import SearchField from '#/components/admin/search-field';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, q } = parseAdminSearchParams(url.searchParams, {
    limit: PAGE_SIZE,
  });

  const data = await loadCompanyAdminIndexData({
    page,
    limit: PAGE_SIZE,
    ...(q ? { q } : {}),
  });

  return {
    companies: data.companies,
    total: data.total,
    page: data.page,
    totalPages: Math.ceil(data.total / PAGE_SIZE),
    q,
  };
}

export default function AdminCompaniesRoute() {
  const t = useT();
  const { companies, total, page, totalPages, q } = useLoaderData();
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /**
   * @param {number} p
   */
  function goToPage(p) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title={t('admin.companies.index.title')}
        subtitle={t('admin.companies.index.subtitle')}
        actions={
          <div className="flex items-center gap-3">
            <Link
              to="/admin/quotes"
              className="text-text-muted hover:text-text text-sm font-medium"
            >
              {t('admin.companies.index.viewQuotes')}
            </Link>
            <Link
              to="/admin/companies/new"
              className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
            >
              <PlusIcon className="h-4 w-4" />
              {t('admin.companies.index.newButton')}
            </Link>
          </div>
        }
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <SearchField
          defaultValue={q}
          placeholder={t('admin.companies.index.searchPlaceholder')}
          formClassName="w-full sm:max-w-sm"
        />
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.companies.index.resultsOne', { count: total })
              : t('admin.companies.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {companies.length === 0 ? (
        <EmptyState
          icon={BuildingOffice2Icon}
          title={
            q
              ? t('admin.companies.index.emptyTitleSearch')
              : t('admin.companies.index.emptyTitle')
          }
          description={
            q
              ? t('admin.companies.index.emptyDescriptionSearch')
              : t('admin.companies.index.emptyDescription')
          }
          action={
            !q && (
              <Link
                to="/admin/companies/new"
                className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
              >
                <PlusIcon className="h-4 w-4" />
                {t('admin.companies.index.newButton')}
              </Link>
            )
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.companies.index.col.company')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.companies.index.col.netTerms')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.companies.index.col.members')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.companies.index.col.quotes')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.companies.index.col.edit')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {companies.map((company) => (
              <Tr
                key={company.id}
                role="link"
                tabIndex={0}
                className="group cursor-pointer"
                onClick={() => navigate(`/admin/companies/${company.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/companies/${company.id}`);
                  }
                }}
              >
                <Td
                  sticky
                  className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                >
                  <span className="block min-w-0">
                    <span className="group-hover:text-accent block truncate font-medium transition-colors">
                      {company.name}
                    </span>
                    {company.taxId ? (
                      <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                        {company.taxId}
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td sticky className="px-3 py-4 tabular-nums">
                  {t('admin.companies.index.netTermsDays', {
                    days: company.netTermsDays,
                  })}
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 tabular-nums sm:table-cell"
                >
                  {company.memberCount ?? 0}
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 tabular-nums md:table-cell"
                >
                  {company.quoteCount ?? 0}
                </Td>
                <Td
                  sticky
                  className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                >
                  <Link
                    to={`/admin/companies/${company.id}`}
                    className="text-accent hover:text-accent-hover"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t('admin.companies.index.edit')}
                    <span className="sr-only">, {company.name}</span>
                  </Link>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
