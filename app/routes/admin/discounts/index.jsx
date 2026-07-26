// app/routes/admin/discounts/index.jsx
// Discounts list — delete, toggle active. Create/edit on dedicated pages.

import {
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Link, useFetcher, useLoaderData } from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui/index.server';
import {
  deleteDiscount,
  listDiscounts,
  toggleDiscountActive,
} from '#/core/discounts/index.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import PageHeader from '#/components/admin/page-header';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader() {
  const { discounts } = await listDiscounts({
    page: 1,
    limit: 500,
    orderBy: { createdAt: 'desc' },
  });
  return { discounts };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  // ── Delete ─────────────────────────────────────────────────────────────────
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

  // ── Toggle active ─────────────────────────────────────────────────────────
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

/** Format a value for display depending on type */
function formatValue(type, value, currency) {
  if (type === 'percent') return `${value}%`;
  const amount = (value / 100).toFixed(2);
  return currency ? `${currency.toUpperCase()} ${amount}` : amount;
}

function formatDate(dateVal) {
  if (!dateVal) return '—';
  return new Date(dateVal).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// DiscountRow
// ---------------------------------------------------------------------------

function DiscountRow({ discount }) {
  const deleteFetcher = useFetcher();
  const toggleFetcher = useFetcher();

  const isExpired =
    discount.expiresAt && new Date(discount.expiresAt) < new Date();

  return (
    <div className="hover:bg-surface-2/50 flex items-center gap-3 px-4 py-3">
      <Link
        to={`/admin/discounts/${discount.id}`}
        className="text-text hover:text-accent w-32 shrink-0 font-mono text-sm font-semibold"
      >
        {discount.code}
      </Link>

      <span className="w-16 shrink-0">
        <Badge tone={discount.type === 'percent' ? 'accent' : 'neutral'}>
          {discount.type}
        </Badge>
      </span>

      <span className="text-text w-24 shrink-0 text-sm">
        {formatValue(discount.type, discount.value, discount.currency)}
      </span>

      <span className="text-text-muted hidden w-28 shrink-0 text-sm sm:block">
        {discount.minSubtotalCents != null
          ? `$${(discount.minSubtotalCents / 100).toFixed(2)}`
          : '—'}
      </span>

      <span className="text-text-muted hidden w-24 shrink-0 text-sm md:block">
        {discount.usedCount}
        {discount.maxUsesCount != null ? ` / ${discount.maxUsesCount}` : ''}
      </span>

      <span className="text-text-muted hidden w-16 shrink-0 text-sm lg:block">
        {discount.currency ? discount.currency.toUpperCase() : '—'}
      </span>

      <span
        className={clsx(
          'hidden w-24 shrink-0 text-sm lg:block',
          isExpired ? 'text-danger' : 'text-text-muted'
        )}
      >
        {formatDate(discount.expiresAt)}
      </span>

      <span className="flex-1" />

      <span className="shrink-0">
        <Badge tone={discount.active ? 'success' : 'neutral'}>
          {discount.active ? 'Active' : 'Inactive'}
        </Badge>
      </span>

      <toggleFetcher.Form method="post">
        <input type="hidden" name="intent" value="toggle-active" />
        <input type="hidden" name="id" value={discount.id} />
        <button
          type="submit"
          title={discount.active ? 'Deactivate' : 'Activate'}
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
        title="Edit"
        className="text-text-muted hover:text-text rounded p-1 transition-colors"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </Link>

      <deleteFetcher.Form
        method="post"
        onSubmit={(e) => {
          if (
            !window.confirm(
              `Delete discount "${discount.code}"? This cannot be undone.`
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
          title="Delete"
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
  const { discounts } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="Discounts"
        subtitle={`${discounts.length} discount${discounts.length !== 1 ? 's' : ''}`}
        actions={
          <Link
            to="/admin/discounts/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            New discount
          </Link>
        }
        className="mb-6"
      />

      <Card padded={false} className="overflow-hidden">
        <div className="border-border bg-surface-2/50 flex items-center gap-3 border-b px-4 py-2">
          <span className="text-text-muted w-32 shrink-0 text-xs font-medium tracking-wide uppercase">
            Code
          </span>
          <span className="text-text-muted w-16 shrink-0 text-xs font-medium tracking-wide uppercase">
            Type
          </span>
          <span className="text-text-muted w-24 shrink-0 text-xs font-medium tracking-wide uppercase">
            Value
          </span>
          <span className="text-text-muted hidden w-28 shrink-0 text-xs font-medium tracking-wide uppercase sm:block">
            Min subtotal
          </span>
          <span className="text-text-muted hidden w-24 shrink-0 text-xs font-medium tracking-wide uppercase md:block">
            Uses
          </span>
          <span className="text-text-muted hidden w-16 shrink-0 text-xs font-medium tracking-wide uppercase lg:block">
            Currency
          </span>
          <span className="text-text-muted hidden w-24 shrink-0 text-xs font-medium tracking-wide uppercase lg:block">
            Expires
          </span>
          <span className="flex-1" />
          <span className="text-text-muted shrink-0 text-xs font-medium tracking-wide uppercase">
            Status
          </span>
          <span className="w-24 shrink-0" />
        </div>

        {discounts.length === 0 ? (
          <div className="text-text-muted px-4 py-10 text-center text-sm">
            No discounts yet.{' '}
            <Link
              to="/admin/discounts/new"
              className="text-accent hover:underline"
            >
              Create your first discount
            </Link>
            .
          </div>
        ) : (
          <div className="divide-border divide-y">
            {discounts.map((discount) => (
              <DiscountRow key={discount.id} discount={discount} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
