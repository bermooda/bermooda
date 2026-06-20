// app/routes/admin/gift-cards/index.jsx

import { Form, useLoaderData } from 'react-router';

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

export default function AdminGiftCardsRoute() {
  const { giftCards, total } = useLoaderData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Gift cards
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Issue gift cards redeemable at checkout.
        </p>
      </div>

      <Form method="post" className="flex flex-wrap gap-3">
        <input type="hidden" name="intent" value="issue" />
        <input
          name="code"
          placeholder="Code (optional)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          name="balanceCents"
          type="number"
          min="1"
          placeholder="Balance (cents)"
          className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          name="currency"
          defaultValue="USD"
          className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          Issue card
        </button>
      </Form>

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-medium">Issued cards ({total})</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="py-2">Code</th>
              <th className="py-2">Balance</th>
              <th className="py-2">Status</th>
              <th className="py-2">Customer</th>
            </tr>
          </thead>
          <tbody>
            {giftCards.map((card) => (
              <tr
                key={card.id}
                className="border-b border-slate-100 dark:border-slate-800"
              >
                <td className="py-2 font-mono">{card.code}</td>
                <td className="py-2">
                  {formatMoney(card.balanceCents, card.currency)}
                </td>
                <td className="py-2">{card.status}</td>
                <td className="py-2">{card.customer?.email ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
