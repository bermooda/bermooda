// app/routes/admin/quotes/index.jsx
// B2B quote workflow admin.

import { PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';
import Card from '#/components/admin/card';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

import {
  createQuote,
  listCompanies,
  listQuotes,
  sendQuote,
} from '#/core/b2b/index.server';

export async function loader() {
  const [quotes, companies, variants] = await Promise.all([
    listQuotes(),
    listCompanies(),
    prisma.productVariant.findMany({
      take: 30,
      orderBy: { updatedAt: 'desc' },
      include: { product: true, prices: true },
    }),
  ]);

  return { quotes, companies, variants };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create-quote') {
    const companyId = formData.get('companyId')?.toString();
    const variantId = formData.get('variantId')?.toString();
    const quantity = parseInt(formData.get('quantity')?.toString() ?? '1', 10);
    const priceCents = parseInt(
      formData.get('priceCents')?.toString() ?? '0',
      10
    );
    const currency = formData.get('currency')?.toString() ?? 'USD';

    if (!companyId || !variantId) {
      return { ok: false, error: 'Company and variant are required.' };
    }

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    await createQuote({
      companyId,
      currency,
      lines: [
        {
          variantId,
          quantity: Number.isNaN(quantity) ? 1 : quantity,
          priceCents: Number.isNaN(priceCents) ? 0 : priceCents,
          titleSnapshot: variant?.product?.title ?? variant?.sku ?? null,
        },
      ],
    });

    return { ok: true };
  }

  if (intent === 'send-quote') {
    const quoteId = formData.get('quoteId')?.toString();
    if (!quoteId) return { ok: false, error: 'Quote required.' };
    await sendQuote(quoteId);
    return { ok: true };
  }

  return { ok: false, error: 'Unknown action.' };
}

function formatMoney(cents, currency) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export default function AdminQuotesRoute() {
  const { quotes, companies, variants } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="B2B quotes"
        subtitle="Draft and send price quotes to company buyers."
        actions={
          <Link
            to="/admin/companies"
            className="text-text-muted hover:text-text text-sm font-medium"
          >
            Companies →
          </Link>
        }
        className="mb-6"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-text mb-4 text-sm font-semibold">New quote</h2>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create-quote" />
            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">
                Company
              </label>
              <Select name="companyId" required>
                <option value="">Select company…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">
                Line item
              </label>
              <Select name="variantId" required>
                <option value="">Select variant…</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku ?? v.id} — {v.product?.title ?? 'Product'}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-text-muted mb-1 block text-xs font-medium">
                  Qty
                </label>
                <Input name="quantity" type="number" min="1" defaultValue="1" />
              </div>
              <div>
                <label className="text-text-muted mb-1 block text-xs font-medium">
                  Price (¢)
                </label>
                <Input
                  name="priceCents"
                  type="number"
                  min="0"
                  defaultValue="0"
                />
              </div>
              <div>
                <label className="text-text-muted mb-1 block text-xs font-medium">
                  Currency
                </label>
                <Input name="currency" defaultValue="USD" />
              </div>
            </div>
            <Button type="submit">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              Create quote
            </Button>
          </Form>
        </Card>

        <Card>
          <h2 className="text-text mb-4 text-sm font-semibold">Quotes</h2>
          {quotes.length === 0 ? (
            <p className="text-text-muted text-sm">No quotes yet.</p>
          ) : (
            <ul className="divide-border divide-y">
              {quotes.map((quote) => (
                <li key={quote.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-text text-sm font-medium">
                        {quote.quoteNumber}
                      </p>
                      <p className="text-text-muted text-xs">
                        {quote.company.name} · {quote._count.lines} line(s) ·{' '}
                        {formatMoney(quote.totalCents, quote.currency)}
                      </p>
                    </div>
                    <span className="text-text-muted text-xs uppercase">
                      {quote.status}
                    </span>
                  </div>
                  {quote.status === 'draft' && (
                    <Form method="post" className="mt-2">
                      <input type="hidden" name="intent" value="send-quote" />
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <Button type="submit" variant="secondary">
                        Mark sent
                      </Button>
                    </Form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
