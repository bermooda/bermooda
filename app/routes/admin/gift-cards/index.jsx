// app/routes/admin/gift-cards/index.jsx

import { PlusIcon } from '@heroicons/react/24/outline';
import { Link, useLoaderData, useSearchParams } from 'react-router';

import { parseAdminSearchParams } from '#/libs/api/admin-ui/index.server';
import { listGiftCards } from '#/core/gift-cards/index.server';
import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import SearchField from '#/components/admin/search-field';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';
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

  return { giftCards, total, page, q };
}

function formatMoney(cents, currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(
    cents / 100
  );
}

function statusTone(status) {
  if (status === 'active') return 'success';
  if (status === 'redeemed' || status === 'disabled') return 'neutral';
  return 'neutral';
}

/**
 * @param {string} status
 * @param {(key: string) => string} t
 */
function giftCardStatusLabel(status, t) {
  const key = `admin.giftCards.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

export default function AdminGiftCardsRoute() {
  const t = useT();
  const { giftCards, total, page, q } = useLoaderData();
  const [searchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        className="mb-6"
      />

      <Toolbar className="mb-4">
        <ToolbarGroup>
          <SearchField
            defaultValue={q}
            placeholder={t('admin.giftCards.index.searchPlaceholder')}
            className="w-64"
          />
        </ToolbarGroup>
      </Toolbar>

      <h2 className="text-text mb-3 text-lg font-semibold">
        {t('admin.giftCards.index.issuedHeading', { total })}
      </h2>
      {giftCards.length === 0 ? (
        <EmptyState
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
            q ? (
              <Link
                to="/admin/gift-cards"
                className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
              >
                {t('admin.giftCards.index.clearSearch')}
              </Link>
            ) : (
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
        <>
          <Table>
            <THead>
              <tr>
                <Th>{t('admin.giftCards.index.col.code')}</Th>
                <Th>{t('admin.giftCards.index.col.balance')}</Th>
                <Th>{t('admin.giftCards.index.col.status')}</Th>
                <Th>{t('admin.giftCards.index.col.customer')}</Th>
              </tr>
            </THead>
            <TBody>
              {giftCards.map((card) => (
                <tr key={card.id}>
                  <Td className="text-text font-mono">{card.code}</Td>
                  <Td className="text-text">
                    {formatMoney(card.balanceCents, card.currency)}
                  </Td>
                  <Td>
                    <Badge tone={statusTone(card.status)}>
                      {giftCardStatusLabel(card.status, t)}
                    </Badge>
                  </Td>
                  <Td>{card.customer?.email ?? '—'}</Td>
                </tr>
              ))}
            </TBody>
          </Table>

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              buildHref={(nextPage) => {
                const params = new URLSearchParams(searchParams);
                if (nextPage <= 1) {
                  params.delete('page');
                } else {
                  params.set('page', String(nextPage));
                }
                const query = params.toString();
                return query
                  ? `/admin/gift-cards?${query}`
                  : '/admin/gift-cards';
              }}
              className="mt-6"
            />
          )}
        </>
      )}
    </div>
  );
}
