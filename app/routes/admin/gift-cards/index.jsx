// app/routes/admin/gift-cards/index.jsx

import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData, useSearchParams } from 'react-router';

import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import { controlClasses } from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

import { listGiftCards } from '#/core/gift-cards/index.server';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const q = url.searchParams.get('q')?.trim() ?? '';

  const { giftCards, total } = await listGiftCards({
    page,
    limit: PAGE_SIZE,
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

export default function AdminGiftCardsRoute() {
  const { giftCards, total, page, q } = useLoaderData();
  const [searchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Gift cards"
        subtitle="Issue gift cards redeemable at checkout."
        actions={
          <Link
            to="/admin/gift-cards/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            Issue gift card
          </Link>
        }
        className="mb-6"
      />

      <Toolbar className="mb-4">
        <ToolbarGroup>
          <Form method="get" className="relative">
            <MagnifyingGlassIcon className="text-text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by code…"
              className={`${controlClasses} w-64 pl-9`}
            />
          </Form>
        </ToolbarGroup>
      </Toolbar>

      <h2 className="text-text mb-3 text-lg font-semibold">
        Issued cards ({total})
      </h2>
      {giftCards.length === 0 ? (
        <EmptyState
          title={
            q ? 'No gift cards match your search' : 'No gift cards issued yet'
          }
          description={
            q
              ? 'Try a different code or clear the search.'
              : 'Issue a gift card for customers to redeem at checkout.'
          }
          action={
            q ? (
              <Link
                to="/admin/gift-cards"
                className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
              >
                Clear search
              </Link>
            ) : (
              <Link
                to="/admin/gift-cards/new"
                className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
              >
                <PlusIcon className="h-4 w-4" />
                Issue gift card
              </Link>
            )
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <Th>Code</Th>
                <Th>Balance</Th>
                <Th>Status</Th>
                <Th>Customer</Th>
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
                    <Badge tone={statusTone(card.status)}>{card.status}</Badge>
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
