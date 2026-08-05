// app/routes/admin/quotes/index.jsx
// B2B quotes list — sticky-header table.

import { DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Form,
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { parseAdminSearchParams } from '#/libs/api/admin-ui/index.server';
import { loadQuoteAdminIndexData, sendQuote } from '#/core/b2b/index.server';
import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page } = parseAdminSearchParams(url.searchParams, {
    limit: PAGE_SIZE,
  });

  const data = await loadQuoteAdminIndexData({
    page,
    limit: PAGE_SIZE,
  });

  return {
    quotes: data.quotes,
    total: data.total,
    page: data.page,
    totalPages: Math.ceil(data.total / PAGE_SIZE),
  };
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
 * @returns {string}
 */
function quoteStatusLabel(status, t) {
  const key = `admin.quotes.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

/**
 * @param {string} status
 * @returns {'success'|'neutral'|'accent'|'warn'|'danger'}
 */
function quoteStatusTone(status) {
  switch (status) {
    case 'accepted':
      return 'success';
    case 'sent':
      return 'accent';
    case 'expired':
      return 'warn';
    case 'cancelled':
      return 'danger';
    case 'draft':
    default:
      return 'neutral';
  }
}

export default function AdminQuotesRoute() {
  const t = useT();
  const { quotes, total, page, totalPages } = useLoaderData();
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

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
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.quotes.index.resultsOne', { count: total })
              : t('admin.quotes.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {quotes.length === 0 ? (
        <EmptyState
          icon={DocumentTextIcon}
          title={t('admin.quotes.index.emptyTitle')}
          description={t('admin.quotes.index.emptyDescription')}
          action={
            <Link
              to="/admin/quotes/new"
              className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
            >
              <PlusIcon className="h-4 w-4" />
              {t('admin.quotes.index.newButton')}
            </Link>
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.quotes.index.col.quote')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.quotes.index.col.company')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.quotes.index.col.status')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.quotes.index.col.total')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.quotes.index.col.actions')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {quotes.map((quote) => (
              <Tr
                key={quote.id}
                role="link"
                tabIndex={0}
                className="group cursor-pointer"
                onClick={() => navigate(`/admin/quotes/${quote.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/quotes/${quote.id}`);
                  }
                }}
              >
                <Td
                  sticky
                  className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                >
                  <span className="block min-w-0">
                    <span className="group-hover:text-accent block truncate font-mono font-medium transition-colors">
                      {quote.quoteNumber}
                    </span>
                    <span className="text-text-muted mt-0.5 block truncate text-xs font-normal sm:hidden">
                      {quote.company?.name ?? '—'}
                    </span>
                  </span>
                </Td>
                <Td sticky className="hidden px-3 py-4 sm:table-cell">
                  {quote.company?.name ?? '—'}
                </Td>
                <Td sticky className="px-3 py-4">
                  <Badge tone={quoteStatusTone(quote.status)}>
                    {quoteStatusLabel(quote.status, t)}
                  </Badge>
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 tabular-nums md:table-cell"
                >
                  <span className="block">{quote.formattedTotal}</span>
                  <span className="text-text-muted text-xs">
                    {t('admin.quotes.index.linesCount', {
                      count: quote.lineCount ?? 0,
                    })}
                  </span>
                </Td>
                <Td
                  sticky
                  className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                >
                  <div
                    className="flex flex-wrap items-center justify-end gap-3"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {quote.status === 'draft' ? (
                      <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="send-quote" />
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <button
                          type="submit"
                          className="text-accent hover:text-accent-hover"
                        >
                          {t('admin.quotes.index.markSent')}
                          <span className="sr-only">, {quote.quoteNumber}</span>
                        </button>
                      </Form>
                    ) : null}
                    <Link
                      to={`/admin/quotes/${quote.id}`}
                      className="text-accent hover:text-accent-hover"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t('admin.quotes.index.view')}
                      <span className="sr-only">, {quote.quoteNumber}</span>
                    </Link>
                  </div>
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
