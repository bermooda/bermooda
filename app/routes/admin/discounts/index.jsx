// app/routes/admin/discounts/index.jsx
// Discounts list — sticky table with search; delete / toggle on dedicated actions.

import {
  CheckIcon,
  PlusIcon,
  TicketIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import {
  Link,
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import {
  handleAdminActionError,
  parseAdminSearchParams,
} from '#/libs/api/admin-ui/index.server';
import {
  deleteDiscount,
  listDiscounts,
  toggleDiscountActive,
} from '#/core/discounts/index.server';
import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import SearchField from '#/components/admin/search-field';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, q } = parseAdminSearchParams(url.searchParams, {
    limit: PAGE_SIZE,
  });

  const { discounts, total } = await listDiscounts({
    page,
    limit: PAGE_SIZE,
    orderBy: { createdAt: 'desc' },
    q: q || undefined,
  });

  return {
    discounts,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    q,
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'delete') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.', intent };

    try {
      await deleteDiscount(id);
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.discounts.delete',
        intent,
        userMessage: 'Could not delete discount.',
      });
    }

    return { ok: true, intent };
  }

  if (intent === 'toggle-active') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.', intent };

    try {
      await toggleDiscountActive(id);
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.discounts.toggle-active',
        intent,
        knownCodes: {
          DISCOUNT_NOT_FOUND: { ok: false, error: 'Not found.' },
        },
        userMessage: 'Could not update discount status.',
      });
    }

    return { ok: true, intent };
  }

  return { ok: false, error: 'Unknown intent.' };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} type
 * @param {number} value
 * @param {string | null | undefined} currency
 * @returns {string}
 */
function formatValue(type, value, currency) {
  if (type === 'percent') return `${value}%`;
  const amount = (value / 100).toFixed(2);
  return currency ? `${currency.toUpperCase()} ${amount}` : amount;
}

/**
 * @param {string | Date | null | undefined} dateVal
 * @returns {string}
 */
function formatDate(dateVal) {
  if (!dateVal) return '—';
  return new Date(dateVal).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * @param {Object} props
 * @param {object} props.discount
 */
function DiscountActions({ discount }) {
  const t = useT();
  const deleteFetcher = useFetcher();
  const toggleFetcher = useFetcher();

  return (
    <div
      className="flex items-center justify-end gap-2"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <toggleFetcher.Form method="post">
        <input type="hidden" name="intent" value="toggle-active" />
        <input type="hidden" name="id" value={discount.id} />
        <button
          type="submit"
          title={
            discount.active
              ? t('admin.discounts.index.deactivate')
              : t('admin.discounts.index.activate')
          }
          disabled={toggleFetcher.state !== 'idle'}
          className={clsx(
            'rounded p-1 text-sm transition-colors disabled:opacity-50',
            discount.active
              ? 'text-success hover:text-danger'
              : 'text-text-muted hover:text-success'
          )}
        >
          <CheckIcon className="h-4 w-4" />
        </button>
      </toggleFetcher.Form>

      <Link
        to={`/admin/discounts/${discount.id}`}
        className="text-accent hover:text-accent-hover text-sm font-medium"
        onClick={(event) => event.stopPropagation()}
      >
        {t('admin.discounts.index.edit')}
        <span className="sr-only">, {discount.code}</span>
      </Link>

      <deleteFetcher.Form
        method="post"
        onSubmit={(e) => {
          if (
            !window.confirm(
              t('admin.discounts.index.confirmDelete', {
                code: discount.code,
              })
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="id" value={discount.id} />
        <button
          type="submit"
          title={t('admin.discounts.index.delete')}
          disabled={deleteFetcher.state !== 'idle'}
          className="text-text-muted hover:text-danger rounded p-1 disabled:opacity-50"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </deleteFetcher.Form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminDiscountsRoute() {
  const t = useT();
  const { discounts, total, page, totalPages, q } = useLoaderData();
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
        title={t('admin.discounts.index.title')}
        subtitle={t('admin.discounts.index.subtitle')}
        actions={
          <Link
            to="/admin/discounts/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.discounts.index.newButton')}
          </Link>
        }
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <SearchField
          defaultValue={q}
          placeholder={t('admin.discounts.index.searchPlaceholder')}
          formClassName="w-full sm:max-w-sm"
        />
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.discounts.index.resultsOne', { count: total })
              : t('admin.discounts.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {discounts.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title={
            q
              ? t('admin.discounts.index.emptyTitleSearch')
              : t('admin.discounts.index.emptyTitle')
          }
          description={
            q
              ? t('admin.discounts.index.emptyDescriptionSearch')
              : t('admin.discounts.index.emptyDescription')
          }
          action={
            !q && (
              <Link
                to="/admin/discounts/new"
                className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
              >
                <PlusIcon className="h-4 w-4" />
                {t('admin.discounts.index.newButton')}
              </Link>
            )
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.discounts.index.col.code')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.discounts.index.col.type')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.discounts.index.col.value')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.discounts.index.col.uses')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 lg:table-cell">
                {t('admin.discounts.index.col.expires')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.discounts.index.col.status')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.discounts.index.col.actions')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {discounts.map((discount) => {
              const isExpired =
                discount.expiresAt && new Date(discount.expiresAt) < new Date();
              return (
                <Tr
                  key={discount.id}
                  role="link"
                  tabIndex={0}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/admin/discounts/${discount.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/admin/discounts/${discount.id}`);
                    }
                  }}
                >
                  <Td
                    sticky
                    className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                  >
                    <span className="block min-w-0">
                      <span className="group-hover:text-accent block truncate font-mono font-medium transition-colors">
                        {discount.code}
                      </span>
                      <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                        {discount.id.slice(0, 8)}
                      </span>
                    </span>
                  </Td>
                  <Td sticky className="px-3 py-4">
                    <Badge
                      tone={discount.type === 'percent' ? 'accent' : 'neutral'}
                    >
                      {discount.type === 'percent'
                        ? t('admin.discounts.type.percent')
                        : discount.type === 'fixed'
                          ? t('admin.discounts.type.fixed')
                          : discount.type}
                    </Badge>
                  </Td>
                  <Td sticky className="px-3 py-4 tabular-nums">
                    {formatValue(
                      discount.type,
                      discount.value,
                      discount.currency
                    )}
                  </Td>
                  <Td
                    sticky
                    className="hidden px-3 py-4 tabular-nums md:table-cell"
                  >
                    {discount.usedCount}
                    {discount.maxUsesCount != null
                      ? ` / ${discount.maxUsesCount}`
                      : ''}
                  </Td>
                  <Td
                    sticky
                    className={clsx(
                      'hidden px-3 py-4 tabular-nums lg:table-cell',
                      isExpired ? 'text-danger' : 'text-text-muted'
                    )}
                  >
                    {formatDate(discount.expiresAt)}
                  </Td>
                  <Td sticky className="px-3 py-4">
                    <Badge tone={discount.active ? 'success' : 'neutral'}>
                      {discount.active
                        ? t('admin.discounts.status.active')
                        : t('admin.discounts.status.inactive')}
                    </Badge>
                  </Td>
                  <Td
                    sticky
                    className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                  >
                    <DiscountActions discount={discount} />
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
