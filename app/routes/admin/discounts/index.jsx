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
import { useState, useEffect } from 'react';
import { useFetcher, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader() {
  const discounts = await prisma.discount.findMany({
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

  // ── Create ─────────────────────────────────────────────────────────────────
  if (intent === 'create') {
    const code = formData.get('code')?.toString().trim().toUpperCase() ?? '';
    const type = formData.get('type')?.toString() ?? '';
    const value = parseInt(formData.get('value') ?? '0', 10);
    const minSubtotalCents = formData.get('minSubtotalCents')?.toString().trim()
      ? parseInt(formData.get('minSubtotalCents'), 10)
      : null;
    const maxUsesCount = formData.get('maxUsesCount')?.toString().trim()
      ? parseInt(formData.get('maxUsesCount'), 10)
      : null;
    const currency = formData.get('currency')?.toString().trim() || null;
    const expiresAtRaw = formData.get('expiresAt')?.toString().trim();
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

    if (!code) return { ok: false, error: 'Code is required.', intent };
    if (!type) return { ok: false, error: 'Type is required.', intent };
    if (!value || value <= 0)
      return { ok: false, error: 'Value must be greater than 0.', intent };
    if (type === 'fixed' && !currency)
      return {
        ok: false,
        error: 'Currency is required for fixed discounts.',
        intent,
      };

    try {
      await prisma.discount.create({
        data: {
          code,
          type,
          value,
          minSubtotalCents,
          maxUsesCount,
          currency: type === 'fixed' ? currency : null,
          expiresAt,
          active: true,
        },
      });
    } catch (err) {
      if (err?.code === 'P2002') {
        return {
          ok: false,
          error: 'A discount with that code already exists.',
          intent,
        };
      }
      throw err;
    }

    return { ok: true, intent };
  }

  // ── Save (edit) ────────────────────────────────────────────────────────────
  if (intent === 'save') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.', intent };

    const code = formData.get('code')?.toString().trim().toUpperCase() ?? '';
    const type = formData.get('type')?.toString() ?? '';
    const value = parseInt(formData.get('value') ?? '0', 10);
    const minSubtotalCents = formData.get('minSubtotalCents')?.toString().trim()
      ? parseInt(formData.get('minSubtotalCents'), 10)
      : null;
    const maxUsesCount = formData.get('maxUsesCount')?.toString().trim()
      ? parseInt(formData.get('maxUsesCount'), 10)
      : null;
    const currency = formData.get('currency')?.toString().trim() || null;
    const expiresAtRaw = formData.get('expiresAt')?.toString().trim();
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    const active = formData.get('active') === 'true';

    if (!code) return { ok: false, error: 'Code is required.', intent };
    if (!type) return { ok: false, error: 'Type is required.', intent };
    if (!value || value <= 0)
      return { ok: false, error: 'Value must be greater than 0.', intent };
    if (type === 'fixed' && !currency)
      return {
        ok: false,
        error: 'Currency is required for fixed discounts.',
        intent,
      };

    try {
      await prisma.discount.update({
        where: { id },
        data: {
          code,
          type,
          value,
          minSubtotalCents,
          maxUsesCount,
          currency: type === 'fixed' ? currency : null,
          expiresAt,
          active,
        },
      });
    } catch (err) {
      if (err?.code === 'P2002') {
        return {
          ok: false,
          error: 'A discount with that code already exists.',
          intent,
        };
      }
      throw err;
    }

    return { ok: true, intent };
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  if (intent === 'delete') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.', intent };

    await prisma.discount.delete({ where: { id } });
    return { ok: true, intent };
  }

  // ── Toggle active ─────────────────────────────────────────────────────────
  if (intent === 'toggle-active') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.', intent };

    const current = await prisma.discount.findUnique({ where: { id } });
    if (!current) return { ok: false, error: 'Not found.', intent };

    await prisma.discount.update({
      where: { id },
      data: { active: !current.active },
    });

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

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Code */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
            Code
          </label>
          <input
            type="text"
            name="code"
            required
            defaultValue={discount?.code ?? ''}
            placeholder="SUMMER20"
            className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm uppercase shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
            Type
          </label>
          <select
            name="type"
            required
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          >
            <option value="percent">Percent (%)</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </div>

        {/* Value */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
            Value{type === 'percent' ? ' (%)' : ' (cents)'}
          </label>
          <input
            type="number"
            name="value"
            required
            min="1"
            defaultValue={discount?.value ?? ''}
            placeholder={type === 'percent' ? '10' : '1000'}
            className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
        </div>

        {/* Currency — only shown for fixed */}
        <div className={clsx(type !== 'fixed' && 'invisible')}>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
            Currency
          </label>
          <input
            type="text"
            name="currency"
            defaultValue={discount?.currency ?? ''}
            placeholder="USD"
            maxLength={3}
            className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm uppercase shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
        </div>

        {/* Min subtotal */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
            Min subtotal (cents, optional)
          </label>
          <input
            type="number"
            name="minSubtotalCents"
            min="0"
            defaultValue={discount?.minSubtotalCents ?? ''}
            placeholder="e.g. 5000"
            className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
        </div>

        {/* Max uses */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
            Max uses (optional)
          </label>
          <input
            type="number"
            name="maxUsesCount"
            min="1"
            defaultValue={discount?.maxUsesCount ?? ''}
            placeholder="e.g. 100"
            className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
        </div>

        {/* Expires at */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
            Expires at (optional)
          </label>
          <input
            type="date"
            name="expiresAt"
            defaultValue={toDateInputValue(discount?.expiresAt)}
            className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Cancel
          </button>
        )}
      </div>
    </fetcher.Form>
  );
}

// ---------------------------------------------------------------------------
// AddDiscountPanel — toggle-open inline create panel
// ---------------------------------------------------------------------------

function AddDiscountPanel() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const fetcher = useFetcher();

  // Close + reset after successful create
  useEffect(() => {
    if (
      fetcher.state === 'idle' &&
      fetcher.data?.ok &&
      fetcher.data?.intent === 'create' &&
      open
    ) {
      setOpen(false);
      setFormKey((k) => k + 1);
    }
  }, [fetcher.state, fetcher.data, open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
      >
        <PlusIcon className="h-4 w-4" />
        Add Discount
      </button>
    );
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          New Discount
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
      <DiscountForm
        discount={null}
        onClose={() => setOpen(false)}
        submitLabel="Create"
        formKey={formKey}
        fetcher={fetcher}
      />
    </div>
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
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-zinc-600 dark:bg-zinc-800/60">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          Edit discount
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {saved && (
        <div className="mb-3 flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          <CheckIcon className="h-4 w-4" />
          Saved.
        </div>
      )}

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
          'flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer',
          isEditing && 'bg-indigo-50 dark:bg-zinc-800/60'
        )}
        onClick={() => onEditToggle(discount.id)}
      >
        {/* Code */}
        <span className="w-32 shrink-0 font-mono text-sm font-semibold text-gray-900 dark:text-white">
          {discount.code}
        </span>

        {/* Type badge */}
        <span
          className={clsx(
            'w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium',
            discount.type === 'percent'
              ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
              : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
          )}
        >
          {discount.type}
        </span>

        {/* Value */}
        <span className="w-24 shrink-0 text-sm text-gray-700 dark:text-zinc-300">
          {formatValue(discount.type, discount.value, discount.currency)}
        </span>

        {/* Min subtotal */}
        <span className="hidden w-28 shrink-0 text-sm text-gray-500 sm:block dark:text-zinc-400">
          {discount.minSubtotalCents != null
            ? `$${(discount.minSubtotalCents / 100).toFixed(2)}`
            : '—'}
        </span>

        {/* Uses */}
        <span className="hidden w-24 shrink-0 text-sm text-gray-500 md:block dark:text-zinc-400">
          {discount.usedCount}
          {discount.maxUsesCount != null ? ` / ${discount.maxUsesCount}` : ''}
        </span>

        {/* Currency */}
        <span className="hidden w-16 shrink-0 text-sm text-gray-500 lg:block dark:text-zinc-400">
          {discount.currency ? discount.currency.toUpperCase() : '—'}
        </span>

        {/* Expires */}
        <span
          className={clsx(
            'hidden w-24 shrink-0 text-sm lg:block',
            isExpired
              ? 'text-red-500 dark:text-red-400'
              : 'text-gray-500 dark:text-zinc-400'
          )}
        >
          {formatDate(discount.expiresAt)}
        </span>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Active badge */}
        <span
          className={clsx(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            discount.active
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'
          )}
        >
          {discount.active ? 'Active' : 'Inactive'}
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
                ? 'text-green-600 hover:text-red-500 dark:text-green-400 dark:hover:text-red-400'
                : 'text-gray-400 hover:text-green-600 dark:hover:text-green-400'
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
            isEditing
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200'
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
            className="rounded p-1 text-gray-400 hover:text-red-500 disabled:opacity-50 dark:hover:text-red-400"
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
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Discounts
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {discounts.length} discount{discounts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <AddDiscountPanel />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
        {/* Column headers */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-2 dark:border-zinc-800">
          <span className="w-32 shrink-0 text-xs font-medium tracking-wide text-gray-400 uppercase dark:text-zinc-500">
            Code
          </span>
          <span className="w-16 shrink-0 text-xs font-medium tracking-wide text-gray-400 uppercase dark:text-zinc-500">
            Type
          </span>
          <span className="w-24 shrink-0 text-xs font-medium tracking-wide text-gray-400 uppercase dark:text-zinc-500">
            Value
          </span>
          <span className="hidden w-28 shrink-0 text-xs font-medium tracking-wide text-gray-400 uppercase sm:block dark:text-zinc-500">
            Min subtotal
          </span>
          <span className="hidden w-24 shrink-0 text-xs font-medium tracking-wide text-gray-400 uppercase md:block dark:text-zinc-500">
            Uses
          </span>
          <span className="hidden w-16 shrink-0 text-xs font-medium tracking-wide text-gray-400 uppercase lg:block dark:text-zinc-500">
            Currency
          </span>
          <span className="hidden w-24 shrink-0 text-xs font-medium tracking-wide text-gray-400 uppercase lg:block dark:text-zinc-500">
            Expires
          </span>
          <span className="flex-1" />
          <span className="shrink-0 text-xs font-medium tracking-wide text-gray-400 uppercase dark:text-zinc-500">
            Status
          </span>
          {/* spacer for action buttons */}
          <span className="w-24 shrink-0" />
        </div>

        {discounts.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
            No discounts yet. Use the button above to create one.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
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
      </div>
    </div>
  );
}
