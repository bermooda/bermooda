// app/routes/admin/subscriptions/index.jsx
// Subscription plans list — sticky-header table.

import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { parseAdminSearchParams } from '#/libs/api/admin-ui/index.server';
import { useT } from '#/core/i18n';
import { loadSubscriptionPlanAdminData } from '#/core/subscriptions/index.server';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page } = parseAdminSearchParams(url.searchParams, {
    limit: PAGE_SIZE,
  });

  const data = await loadSubscriptionPlanAdminData({
    page,
    limit: PAGE_SIZE,
  });

  return {
    plans: data.plans,
    total: data.total,
    page: data.page,
    totalPages: Math.ceil(data.total / PAGE_SIZE),
  };
}

export default function AdminSubscriptionsRoute() {
  const t = useT();
  const { plans, total, page, totalPages } = useLoaderData();
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
        title={t('admin.subscriptions.index.title')}
        subtitle={t('admin.subscriptions.index.subtitle')}
        actions={
          <Link
            to="/admin/subscriptions/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.subscriptions.index.newButton')}
          </Link>
        }
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.subscriptions.index.resultsOne', { count: total })
              : t('admin.subscriptions.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {plans.length === 0 ? (
        <EmptyState
          icon={ArrowPathIcon}
          title={t('admin.subscriptions.index.emptyTitle')}
          description={t('admin.subscriptions.index.emptyDescription')}
          action={
            <Link
              to="/admin/subscriptions/new"
              className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
            >
              <PlusIcon className="h-4 w-4" />
              {t('admin.subscriptions.index.newButton')}
            </Link>
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.subscriptions.index.col.plan')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.subscriptions.index.col.interval')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.subscriptions.index.col.status')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.subscriptions.index.col.edit')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {plans.map((plan) => (
              <Tr
                key={plan.id}
                role="link"
                tabIndex={0}
                className="group cursor-pointer"
                onClick={() => navigate(`/admin/subscriptions/${plan.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/subscriptions/${plan.id}`);
                  }
                }}
              >
                <Td
                  sticky
                  className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                >
                  <span className="block min-w-0">
                    <span className="group-hover:text-accent block truncate font-medium transition-colors">
                      {plan.name}
                    </span>
                    {plan.variant?.sku ? (
                      <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                        {plan.variant.sku}
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td sticky className="px-3 py-4">
                  {t('admin.subscriptions.index.intervalMeta', {
                    count: plan.intervalCount,
                    interval: plan.interval,
                  })}
                </Td>
                <Td sticky className="px-3 py-4">
                  <Badge tone={plan.active ? 'success' : 'neutral'}>
                    {plan.active
                      ? t('admin.subscriptions.status.active')
                      : t('admin.subscriptions.status.inactive')}
                  </Badge>
                </Td>
                <Td
                  sticky
                  className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                >
                  <Link
                    to={`/admin/subscriptions/${plan.id}`}
                    className="text-accent hover:text-accent-hover"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t('admin.subscriptions.index.edit')}
                    <span className="sr-only">, {plan.name}</span>
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
