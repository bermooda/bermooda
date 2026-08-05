import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { getQuote, sendQuote } from '#/core/b2b/index.server';
import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

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

/**
 * @param {string} status
 * @param {(key: string) => string} t
 * @returns {string}
 */
function quoteStatusLabel(status, t) {
  const key = `admin.quotes.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

export default function AdminQuoteDetailRoute() {
  const t = useT();
  const { quote } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';
  const isDraft = quote.status === 'draft';

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.quotes.detail.breadcrumb'),
                href: '/admin/quotes',
              },
              { label: quote.quoteNumber },
            ]}
          />
        }
        title={quote.quoteNumber}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={isDraft ? 'neutral' : 'success'}>
              {quoteStatusLabel(quote.status, t)}
            </Badge>
            <span>
              {quote.company?.name ?? t('admin.quotes.detail.companyFallback')}{' '}
              · {quote.formattedTotal}
            </span>
          </span>
        }
        actions={
          isDraft ? (
            <Form method="post">
              <input type="hidden" name="intent" value="send-quote" />
              <ButtonSubmit disabled={isSaving}>
                {isSaving
                  ? t('admin.quotes.detail.sending')
                  : t('admin.quotes.detail.markSent')}
              </ButtonSubmit>
            </Form>
          ) : null
        }
      />

      <ErrorAlert message={actionData?.error} />
      {actionData?.ok && (
        <SuccessAlert message={t('admin.quotes.detail.updated')} />
      )}

      <div className="space-y-12">
        <FormSection title={t('admin.quotes.detail.summary')}>
          <dl className="grid max-w-2xl gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-text-muted">
                {t('admin.quotes.detail.company')}
              </dt>
              <dd className="text-text font-medium">
                {quote.company?.name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">
                {t('admin.quotes.detail.currency')}
              </dt>
              <dd className="text-text font-medium">{quote.currency}</dd>
            </div>
            <div>
              <dt className="text-text-muted">
                {t('admin.quotes.detail.total')}
              </dt>
              <dd className="text-text font-medium tabular-nums">
                {quote.formattedTotal}
              </dd>
            </div>
          </dl>
        </FormSection>

        <FormSection title={t('admin.quotes.detail.lineItems')} last>
          {(quote.lines ?? []).length === 0 ? (
            <p className="text-text-muted text-sm">
              {t('admin.quotes.detail.noLineItems')}
            </p>
          ) : (
            <ul className="divide-border max-w-2xl divide-y text-sm">
              {(quote.lines ?? []).map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-text font-medium">
                      {line.titleSnapshot ??
                        line.variant?.productTitle ??
                        line.variantId}
                    </p>
                    <p className="text-text-muted text-xs">
                      {line.variant?.sku ? `${line.variant.sku} · ` : ''}
                      {t('admin.quotes.detail.qty', {
                        quantity: line.quantity,
                      })}
                    </p>
                  </div>
                  <span className="text-text font-mono text-xs tabular-nums">
                    {line.priceCents}¢
                  </span>
                </li>
              ))}
            </ul>
          )}
        </FormSection>
      </div>
    </div>
  );
}
