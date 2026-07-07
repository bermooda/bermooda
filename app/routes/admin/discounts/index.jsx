// app/routes/admin/discounts/index.jsx
// Discounts CRUD — list, create, inline edit, delete, toggle active.

import {
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  PencilSquareIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useState } from 'react';
import { Link, useFetcher, useLoaderData } from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui.server';
import {
  deleteDiscount,
  listDiscounts,
  parseDiscountFormData,
  toggleDiscountActive,
  updateDiscount,
} from '#/core/discounts/index.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

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

  // ── Save (edit) ────────────────────────────────────────────────────────────
  if (intent === 'save') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.', intent };

    const active = formData.get('active') === 'true';
    const parsed = parseDiscountFormData(formData, { active });
    if (parsed.error) {
      return { ok: false, error: parsed.error, intent };
    }

    try {
      await updateDiscount(id, parsed.data);
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.discounts.save',
        intent,
        knownCodes: {
          P2002: {
            ok: false,
            error: 'A discount with that code already exists.',
          },
        },
        userMessage: 'Could not save discount.',
      });
    }

    return { ok: true, intent };
  }

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
  // fixed: value is in cents
  const amount = (value / 100).toFixed(2);
  return currency ? `${currency.toUpperCase()} ${amount}` : amount;
}

function formatDate(dateVal) {
  if (!dateVal) return '—';
  return new Date(dateVal).toLocaleDateString();
}

/** ISO date string for <input type="date"> */
function toDateInputValue(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// DiscountForm — shared create/edit form fields
// ---------------------------------------------------------------------------

function DiscountForm({
  discount,
  onClose,
  submitLabel,
  formKey,
  fetcher: fetcherProp,
}) {
  const ownFetcher = useFetcher();
  const fetcher = fetcherProp ?? ownFetcher;
  const [type, setType] = useState(discount?.type ?? 'percent');
  const isSubmitting = fetcher.state !== 'idle';
  const error =
    fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok
      ? fetcher.data.error
      : null;

  return (
    <fetcher.Form key={formKey} method="post" className="space-y-4">
      {discount ? (
        <>
          <input type="hidden" name="intent" value="save" />
          <input type="hidden" name="id" value={discount.id} />
          <input type="hidden" name="active" value={String(discount.active)} />
        </>
      ) : (
        <input type="hidden" name="intent" value="create" />
      )}

      <ErrorAlert message={error} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Code" className="space-y-1">
          <Input
            type="text"
            name="code"
            required
            defaultValue={discount?.code ?? ''}
            placeholder="SUMMER20"
            className="uppercase"
          />
        </Field>

        <Field label="Type" className="space-y-1">
          <Select
            name="type"
            required
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="percent">Percent (%)</option>
            <option value="fixed">Fixed amount</option>
          </Select>
        </Field>

        <Field
          label={`Value${type === 'percent' ? ' (%)' : ' (cents)'}`}
          className="space-y-1"
        >
          <Input
            type="number"
            name="value"
            required
            min="1"
            defaultValue={discount?.value ?? ''}
            placeholder={type === 'percent' ? '10' : '1000'}
          />
        </Field>

        {/* Currency — only shown for fixed */}
        <Field
          label="Currency"
          className={clsx('space-y-1', type !== 'fixed' && 'invisible')}
        >
          <Input
            type="text"
            name="currency"
            defaultValue={discount?.currency ?? ''}
            placeholder="USD"
            maxLength={3}
            className="uppercase"
          />
        </Field>

        <Field label="Min subtotal (cents, optional)" className="space-y-1">
          <Input
            type="number"
            name="minSubtotalCents"
            min="0"
            defaultValue={discount?.minSubtotalCents ?? ''}
            placeholder="e.g. 5000"
          />
        </Field>

        <Field label="Max uses (optional)" className="space-y-1">
          <Input
            type="number"
            name="maxUsesCount"
            min="1"
            defaultValue={discount?.maxUsesCount ?? ''}
            placeholder="e.g. 100"
          />
        </Field>

        <Field label="Expires at (optional)" className="space-y-1">
          <Input
            type="date"
            name="expiresAt"
            defaultValue={toDateInputValue(discount?.expiresAt)}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <ButtonSubmit loading={isSubmitting}>{submitLabel}</ButtonSubmit>
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
    </fetcher.Form>
  );
}

// ---------------------------------------------------------------------------
// InlineEditForm
// ---------------------------------------------------------------------------

function InlineEditForm({ discount, onClose }) {
  const fetcher = useFetcher();
  const saved =
    fetcher.state === 'idle' &&
    fetcher.data?.ok &&
    fetcher.data?.intent === 'save';

  return (
    <div className="border-border bg-surface-2 rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-text text-sm font-semibold">Edit discount</span>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:text-text rounded p-1"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {saved && <SuccessAlert message="Saved." />}

      <DiscountForm
        discount={discount}
        onClose={onClose}
        submitLabel="Save"
        fetcher={fetcher}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiscountRow
// ---------------------------------------------------------------------------

function DiscountRow({ discount, editingId, onEditToggle }) {
  const deleteFetcher = useFetcher();
  const toggleFetcher = useFetcher();
  const isEditing = editingId === discount.id;

  const isExpired =
    discount.expiresAt && new Date(discount.expiresAt) < new Date();

  return (
    <div>
      {/* Row */}
      <div
        className={clsx(
          'hover:bg-surface-2/50 flex cursor-pointer items-center gap-3 px-4 py-3',
          isEditing && 'bg-surface-2/60'
        )}
        onClick={() => onEditToggle(discount.id)}
      >
        {/* Code */}
        <span className="text-text w-32 shrink-0 font-mono text-sm font-semibold">
          {discount.code}
        </span>

        {/* Type badge */}
        <span className="w-16 shrink-0">
          <Badge tone={discount.type === 'percent' ? 'accent' : 'neutral'}>
            {discount.type}
          </Badge>
        </span>

        {/* Value */}
        <span className="text-text w-24 shrink-0 text-sm">
          {formatValue(discount.type, discount.value, discount.currency)}
        </span>

        {/* Min subtotal */}
        <span className="text-text-muted hidden w-28 shrink-0 text-sm sm:block">
          {discount.minSubtotalCents != null
            ? `$${(discount.minSubtotalCents / 100).toFixed(2)}`
            : '—'}
        </span>

        {/* Uses */}
        <span className="text-text-muted hidden w-24 shrink-0 text-sm md:block">
          {discount.usedCount}
          {discount.maxUsesCount != null ? ` / ${discount.maxUsesCount}` : ''}
        </span>

        {/* Currency */}
        <span className="text-text-muted hidden w-16 shrink-0 text-sm lg:block">
          {discount.currency ? discount.currency.toUpperCase() : '—'}
        </span>

        {/* Expires */}
        <span
          className={clsx(
            'hidden w-24 shrink-0 text-sm lg:block',
            isExpired ? 'text-danger' : 'text-text-muted'
          )}
        >
          {formatDate(discount.expiresAt)}
        </span>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Active badge */}
        <span className="shrink-0">
          <Badge tone={discount.active ? 'success' : 'neutral'}>
            {discount.active ? 'Active' : 'Inactive'}
          </Badge>
        </span>

        {/* Toggle active */}
        <toggleFetcher.Form method="post" onClick={(e) => e.stopPropagation()}>
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

        {/* Edit */}
        <button
          type="button"
          title="Edit"
          onClick={(e) => {
            e.stopPropagation();
            onEditToggle(discount.id);
          }}
          className={clsx(
            'rounded p-1 transition-colors',
            isEditing ? 'text-accent' : 'text-text-muted hover:text-text'
          )}
        >
          <PencilSquareIcon className="h-4 w-4" />
        </button>

        {/* Delete */}
        <deleteFetcher.Form
          method="post"
          onClick={(e) => e.stopPropagation()}
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

      {/* Inline edit panel */}
      {isEditing && (
        <div className="px-4 pb-4">
          <InlineEditForm
            discount={discount}
            onClose={() => onEditToggle(null)}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminDiscountsRoute() {
  const { discounts } = useLoaderData();
  const [editingId, setEditingId] = useState(null);

  function handleEditToggle(id) {
    setEditingId((prev) => (prev === id ? null : id));
  }

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

      {/* Table */}
      <Card padded={false} className="overflow-hidden">
        {/* Column headers */}
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
          {/* spacer for action buttons */}
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
              <DiscountRow
                key={discount.id}
                discount={discount}
                editingId={editingId}
                onEditToggle={handleEditToggle}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
