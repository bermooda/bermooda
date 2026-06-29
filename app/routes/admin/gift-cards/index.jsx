// app/routes/admin/gift-cards/index.jsx

import { PlusIcon } from '@heroicons/react/24/outline';
import { Link, useLoaderData } from 'react-router';

import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';

import { listGiftCards } from '#/core/gift-cards/index.server';

export async function loader() {
  const { giftCards, total } = await listGiftCards({ limit: 100 });
  return { giftCards, total };
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
  const { giftCards, total } = useLoaderData();

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

      <h2 className="text-text mb-3 text-lg font-semibold">
        Issued cards ({total})
      </h2>
      {giftCards.length === 0 ? (
        <EmptyState
          title="No gift cards issued yet"
          description="Issue a gift card for customers to redeem at checkout."
          action={
            <Link
              to="/admin/gift-cards/new"
              className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
            >
              <PlusIcon className="h-4 w-4" />
              Issue gift card
            </Link>
          }
        />
      ) : (
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
      )}
    </div>
  );
}
