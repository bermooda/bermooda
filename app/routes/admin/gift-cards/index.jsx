// app/routes/admin/gift-cards/index.jsx
// Gift cards admin list — sticky-header table with search.

import { GiftIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Link, useLoaderData, useSearchParams } from 'react-router';

import { parseAdminSearchParams } from '#/libs/api/admin-ui/index.server';
import { listGiftCards } from '#/core/gift-cards/index.server';
import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import SearchField from '#/components/admin/search-field';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const {
    page,
    limit: pageSize,
    q,
  } = parseAdminSearchParams(url.searchParams, {
    limit: PAGE_SIZE,
  });

  const { giftCards, total } = await listGiftCards({
    page,
    limit: pageSize,
    q: q || undefined,
  });

  return {
    giftCards,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
    q,
  };
}

/**
 * @param {number} cents
 * @param {string} currency
 * @returns {string}
 */
function formatMoney(cents, currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(
    cents / 100
  );
}

/**
 * @param {string} status
 * @returns {'success'|'neutral'}
 */
function statusTone(status) {
  if (status === 'active') return 'success';
  return 'neutral';
}

/**
 * @param {string} status
 * @param {(key: string) => string} t
 * @returns {string}
 */
function giftCardStatusLabel(status, t) {
  const key = `admin.giftCards.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

export default function AdminGiftCardsRoute() {
  const t = useT();
  const { giftCards, total, page, totalPages, q } = useLoaderData();
  const [, setSearchParams] = useSearchParams();

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
        title={t('admin.giftCards.index.title')}
        subtitle={t('admin.giftCards.index.subtitle')}
        actions={
          <Link
            to="/admin/gift-cards/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.giftCards.index.issueButton')}
          </Link>
        }
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <SearchField
          defaultValue={q}
          placeholder={t('admin.giftCards.index.searchPlaceholder')}
          formClassName="w-full sm:max-w-sm"
        />
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.giftCards.index.resultsOne', { count: total })
              : t('admin.giftCards.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {giftCards.length === 0 ? (
        <EmptyState
          icon={GiftIcon}
          title={
            q
              ? t('admin.giftCards.index.emptyTitleSearch')
              : t('admin.giftCards.index.emptyTitle')
          }
          description={
            q
              ? t('admin.giftCards.index.emptyDescriptionSearch')
              : t('admin.giftCards.index.emptyDescription')
          }
          action={
            !q && (
              <Link
                to="/admin/gift-cards/new"
                className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
              >
                <PlusIcon className="h-4 w-4" />
                {t('admin.giftCards.index.issueButton')}
              </Link>
            )
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.giftCards.index.col.code')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.giftCards.index.col.balance')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.giftCards.index.col.status')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.giftCards.index.col.customer')}
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {giftCards.map((card) => (
              <Tr key={card.id}>
                <Td
                  sticky
                  className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                >
                  <span className="block min-w-0">
                    <span className="block truncate font-mono font-medium">
                      {card.code}
                    </span>
                    <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                      {card.id.slice(0, 8)}
                    </span>
                  </span>
                </Td>
                <Td sticky className="px-3 py-4 tabular-nums">
                  {formatMoney(card.balanceCents, card.currency)}
                </Td>
                <Td sticky className="px-3 py-4">
                  <Badge tone={statusTone(card.status)}>
                    {giftCardStatusLabel(card.status, t)}
                  </Badge>
                </Td>
                <Td
                  sticky
                  className="text-text-muted hidden px-3 py-4 sm:table-cell"
                >
                  {card.customer?.email ?? '—'}
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
