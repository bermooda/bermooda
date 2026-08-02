// app/routes/admin/quotes/index.jsx
// B2B quotes list.

import { PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData } from 'react-router';

import { loadQuoteAdminIndexData, sendQuote } from '#/core/b2b/index.server';
import { useT } from '#/core/i18n';
import Card from '#/components/admin/card';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

export async function loader() {
  return loadQuoteAdminIndexData();
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  try {
    if (intent === 'send-quote') {
      const quoteId = formData.get('quoteId')?.toString();
      if (!quoteId) return { ok: false, error: 'Quote required.' };
      await sendQuote(quoteId);
      return { ok: true };
    }

    return { ok: false, error: 'Unknown action.' };
  } catch (err) {
    return { ok: false, error: err.message ?? 'Could not update quote.' };
  }
}

/**
 * @param {string} status
 * @param {(key: string) => string} t
 */
function quoteStatusLabel(status, t) {
  const key = `admin.quotes.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

export default function AdminQuotesRoute() {
  const t = useT();
  const { quotes } = useLoaderData();

  return (
    <div>
      <PageHeader
        title={t('admin.quotes.index.title')}
        subtitle={t('admin.quotes.index.subtitle')}
        actions={
          <div className="flex items-center gap-3">
            <Link
              to="/admin/companies"
              className="text-text-muted hover:text-text text-sm font-medium"
            >
              {t('admin.quotes.index.companiesLink')}
            </Link>
            <Link
              to="/admin/quotes/new"
              className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
            >
              <PlusIcon className="h-4 w-4" />
              {t('admin.quotes.index.newButton')}
            </Link>
          </div>
        }
        className="mb-6"
      />

      <Card>
        <h2 className="text-text mb-4 text-sm font-semibold">
          {t('admin.quotes.index.quotesHeading')}
        </h2>
        {quotes.length === 0 ? (
          <p className="text-text-muted text-sm">
            {t('admin.quotes.index.empty')}{' '}
            <Link
              to="/admin/quotes/new"
              className="text-accent hover:underline"
            >
              {t('admin.quotes.index.emptyLink')}
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {quotes.map((quote) => (
              <li key={quote.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/admin/quotes/${quote.id}`}
                    className="hover:text-accent block"
                  >
                    <p className="text-text text-sm font-medium">
                      {quote.quoteNumber}
                    </p>
                    <p className="text-text-muted text-xs">
                      {t('admin.quotes.index.linesMeta', {
                        company: quote.company?.name ?? '',
                        count: quote.lineCount ?? 0,
                        total: quote.formattedTotal,
                      })}
                    </p>
                  </Link>
                  <span className="text-text-muted text-xs uppercase">
                    {quoteStatusLabel(quote.status, t)}
                  </span>
                </div>
                {quote.status === 'draft' && (
                  <Form method="post" className="mt-2">
                    <input type="hidden" name="intent" value="send-quote" />
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <Button type="submit" variant="secondary">
                      {t('admin.quotes.index.markSent')}
                    </Button>
                  </Form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
