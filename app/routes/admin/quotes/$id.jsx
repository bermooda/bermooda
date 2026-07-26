import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { getQuote, sendQuote } from '#/core/b2b/index.server';
import ActionBar from '#/components/admin/action-bar';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

export async function loader({ params }) {
  try {
    const quote = await getQuote(params.id);
    return { quote };
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.status === 404) {
      throw new Response('Quote not found', { status: 404 });
    }
    throw err;
  }
}

export async function action({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  try {
    if (intent === 'send-quote') {
      await sendQuote(params.id);
      return redirect(`/admin/quotes/${params.id}`);
    }
    return { error: 'Unknown action.' };
  } catch (err) {
    return { error: err.message ?? 'Could not update quote.' };
  }
}

export function meta({ loaderData }) {
  const number = loaderData?.quote?.quoteNumber ?? 'Quote';
  return [{ title: `${number} — Quotes` }];
}

export default function AdminQuoteDetailRoute() {
  const { quote } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Quotes', href: '/admin/quotes' },
              { label: quote.quoteNumber },
            ]}
          />
        }
        title={quote.quoteNumber}
        subtitle={`${quote.company?.name ?? 'Company'} · ${quote.formattedTotal}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={quote.status === 'draft' ? 'neutral' : 'success'}>
              {quote.status}
            </Badge>
            <Button as={Link} to="/admin/quotes" variant="secondary">
              Back
            </Button>
          </div>
        }
      />

      <ErrorAlert message={actionData?.error} />
      {actionData?.ok && <SuccessAlert message="Quote updated." />}

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader title="Summary" />
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-text-muted">Company</dt>
              <dd className="text-text font-medium">
                {quote.company?.name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Currency</dt>
              <dd className="text-text font-medium">{quote.currency}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Total</dt>
              <dd className="text-text font-medium">{quote.formattedTotal}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Line items" />
          {(quote.lines ?? []).length === 0 ? (
            <p className="text-text-muted text-sm">No line items.</p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {(quote.lines ?? []).map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div>
                    <p className="text-text font-medium">
                      {line.titleSnapshot ??
                        line.variant?.productTitle ??
                        line.variantId}
                    </p>
                    <p className="text-text-muted text-xs">
                      {line.variant?.sku ? `${line.variant.sku} · ` : ''}
                      Qty {line.quantity}
                    </p>
                  </div>
                  <span className="text-text font-mono text-xs">
                    {line.priceCents}¢
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {quote.status === 'draft' && (
          <Form method="post">
            <input type="hidden" name="intent" value="send-quote" />
            <ActionBar>
              <span />
              <ButtonSubmit disabled={isSaving}>
                {isSaving ? 'Sending…' : 'Mark sent'}
              </ButtonSubmit>
            </ActionBar>
          </Form>
        )}
      </div>
    </div>
  );
}
