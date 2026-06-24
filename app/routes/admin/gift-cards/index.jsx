// app/routes/admin/gift-cards/index.jsx

import { Form, useLoaderData } from 'react-router';

import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';
import Button from '#/components/ui/button';

import {
  generateGiftCardCode,
  issueGiftCard,
  listGiftCards,
} from '#/core/gift-cards/index.server';

export async function loader() {
  const { giftCards, total } = await listGiftCards({ limit: 100 });
  return { giftCards, total };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'issue') {
    const code =
      formData.get('code')?.toString().trim() || generateGiftCardCode();
    const balanceCents = parseInt(
      formData.get('balanceCents')?.toString() ?? '0',
      10
    );
    const currency =
      formData.get('currency')?.toString().trim().toUpperCase() || 'USD';

    if (!balanceCents || balanceCents <= 0) {
      return { ok: false, error: 'Balance must be greater than zero.' };
    }

    const giftCard = await issueGiftCard({ code, balanceCents, currency });
    return { ok: true, code: giftCard.code };
  }

  return { ok: false, error: 'Unknown action.' };
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
        className="mb-6"
      />

      <Card className="mb-6">
        <Form method="post" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="intent" value="issue" />
          <Input name="code" placeholder="Code (optional)" className="w-auto" />
          <Input
            name="balanceCents"
            type="number"
            min="1"
            placeholder="Balance (cents)"
            className="w-40"
          />
          <Input name="currency" defaultValue="USD" className="w-24" />
          <Button type="submit" variant="primary">
            Issue card
          </Button>
        </Form>
      </Card>

      <h2 className="text-text mb-3 text-lg font-semibold">
        Issued cards ({total})
      </h2>
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
          {giftCards.length === 0 ? (
            <tr>
              <Td colSpan={4} className="py-8 text-center">
                No gift cards issued yet.
              </Td>
            </tr>
          ) : (
            giftCards.map((card) => (
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
            ))
          )}
        </TBody>
      </Table>
    </div>
  );
}
