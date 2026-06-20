// app/routes/admin/orders/$id.jsx
// Order detail — line items, payment info, address, shipments, refunds,
// manual notes, and status transitions.

import clsx from 'clsx';
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import prisma from '#/libs/prisma.server';

// Server-only core calls are dynamically imported in `action` to avoid a
// circular bundle graph (returns → orders) in this route module.

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ params }) {
  const { id } = params;

  const order = await prisma.order.findUniqueOrThrow({
    where: { id },
    include: {
      lines: { orderBy: { createdAt: 'asc' } },
      shipments: {
        orderBy: { createdAt: 'asc' },
        include: { lines: { include: { orderLine: true } } },
      },
      refunds: { orderBy: { createdAt: 'asc' } },
      returns: {
        orderBy: { createdAt: 'asc' },
        include: { lines: { include: { orderLine: true } } },
      },
      customer: { select: { email: true, name: true } },
    },
  });

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      status: order.status,
      currency: order.currency,
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
      shippingAddressJson: order.shippingAddressJson,
      billingAddressJson: order.billingAddressJson ?? null,
      paymentProvider: order.paymentProvider ?? null,
      paymentIntentId: order.paymentIntentId ?? null,
      couponCode: order.couponCode ?? null,
      notes: order.notes ?? '',
      createdAt: order.createdAt.toISOString(),
      customer: order.customer
        ? { email: order.customer.email, name: order.customer.name ?? null }
        : null,
      lines: order.lines.map((l) => ({
        id: l.id,
        title: l.title,
        sku: l.sku ?? null,
        quantity: l.quantity,
        fulfilledQuantity: l.fulfilledQuantity ?? 0,
        returnedQuantity: l.returnedQuantity ?? 0,
        priceCents: l.priceCents,
        totalCents: l.totalCents,
      })),
      shipments: order.shipments.map((s) => ({
        id: s.id,
        status: s.status,
        carrier: s.carrier ?? null,
        trackingNumber: s.trackingNumber ?? null,
        trackingUrl: s.trackingUrl ?? null,
        shippedAt: s.shippedAt?.toISOString() ?? null,
        deliveredAt: s.deliveredAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
      refunds: order.refunds.map((r) => ({
        id: r.id,
        amountCents: r.amountCents,
        reason: r.reason ?? null,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      returns: order.returns.map((ret) => ({
        id: ret.id,
        status: ret.status,
        reason: ret.reason ?? null,
        resolution: ret.resolution ?? null,
        storeCreditCents: ret.storeCreditCents ?? null,
        createdAt: ret.createdAt.toISOString(),
        lines: ret.lines.map((l) => ({
          id: l.id,
          orderLineId: l.orderLineId,
          title: l.orderLine?.title ?? '',
          quantity: l.quantity,
          restocked: l.restocked,
        })),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request, params }) {
  const { id } = params;
  const formData = await request.formData();
  const intent = formData.get('intent');

  const needsOrdersCore = [
    'add-shipment',
    'mark-delivered',
    'add-refund',
  ].includes(intent);
  const needsReturnsCore = [
    'approve-return',
    'receive-return',
    'complete-return',
  ].includes(intent);

  const ordersCore = needsOrdersCore
    ? await import('#/core/orders/index.server')
    : null;
  const returnsCore = needsReturnsCore
    ? await import('#/core/returns/index.server')
    : null;

  if (intent === 'update-status') {
    const newStatus = formData.get('status');

    const VALID_TRANSITIONS = {
      pending: ['paid'],
      pending_payment: ['paid', 'cancelled'],
      paid: ['fulfilled', 'cancelled'],
      fulfilled: ['cancelled', 'refunded'],
    };

    const current = await prisma.order.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });

    const allowed = VALID_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return { ok: false, error: 'Invalid status transition.' };
    }

    await prisma.order.update({
      where: { id },
      data: { status: newStatus },
    });
    return { ok: true, intent };
  }

  if (intent === 'add-shipment') {
    const carrier = formData.get('carrier')?.toString().trim() || null;
    const trackingNumber =
      formData.get('trackingNumber')?.toString().trim() || null;
    const trackingUrl = formData.get('trackingUrl')?.toString().trim() || null;

    const lines = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('ship-qty-')) {
        const orderLineId = key.slice(9);
        const quantity = parseInt(String(value), 10);
        if (quantity > 0) {
          lines.push({ orderLineId, quantity });
        }
      }
    }

    try {
      const shipment = await ordersCore.addShipment(id, {
        carrier,
        trackingNumber,
        trackingUrl,
        lines: lines.length > 0 ? lines : undefined,
      });
      await ordersCore.markShipped(shipment.id, {
        carrier,
        trackingNumber,
        trackingUrl,
      });
      return { ok: true, intent };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (intent === 'mark-delivered') {
    const shipmentId = formData.get('shipmentId')?.toString();
    if (!shipmentId) return { ok: false, error: 'Missing shipmentId' };
    try {
      await ordersCore.markDelivered(shipmentId);
      return { ok: true, intent };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (intent === 'add-refund') {
    const amountCents = parseInt(formData.get('amountCents') ?? '0', 10);
    const reason = formData.get('reason')?.toString().trim() || null;

    try {
      await ordersCore.createRefund(id, { amountCents, reason });
      return { ok: true, intent };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (intent === 'approve-return') {
    const returnId = formData.get('returnId')?.toString();
    const resolution = formData.get('resolution')?.toString() || 'refund';
    try {
      await returnsCore.approveReturn(returnId, { resolution });
      return { ok: true, intent };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (intent === 'receive-return') {
    const returnId = formData.get('returnId')?.toString();
    try {
      await returnsCore.receiveReturn(returnId);
      return { ok: true, intent };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (intent === 'complete-return') {
    const returnId = formData.get('returnId')?.toString();
    const resolution = formData.get('resolution')?.toString() || undefined;
    try {
      await returnsCore.completeReturn(returnId, { resolution });
      return { ok: true, intent };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (intent === 'update-notes') {
    const notes = formData.get('notes')?.toString() ?? '';
    await prisma.order.update({
      where: { id },
      data: { notes },
    });
    return { ok: true, intent };
  }

  return { ok: false, error: 'Unknown intent.' };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CLASSES = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  pending_payment:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  fulfilled:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  refunded: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

function StatusBadge({ status }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        STATUS_CLASSES[status] ??
          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
      )}
    >
      {status}
    </span>
  );
}

function formatCents(cents, currency = 'USD') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
      <div className="border-b border-gray-200 px-6 py-4 dark:border-zinc-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}

function AddressDisplay({ json, label }) {
  if (!json) return null;
  let addr;
  try {
    addr = JSON.parse(json);
  } catch {
    return (
      <p className="text-sm text-gray-500 dark:text-zinc-400">
        {label}: (invalid JSON)
      </p>
    );
  }

  const lines = [
    addr.name,
    addr.company,
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '),
    addr.country,
    addr.phone,
  ].filter(Boolean);

  return (
    <div>
      {label && (
        <p className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
          {label}
        </p>
      )}
      <address className="text-sm text-gray-700 not-italic dark:text-zinc-300">
        {lines.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </address>
    </div>
  );
}

// Determines which status transition buttons to show
const STATUS_TRANSITIONS = {
  pending: [{ label: 'Mark as Paid', status: 'paid' }],
  pending_payment: [
    { label: 'Confirm Payment', status: 'paid' },
    { label: 'Cancel Order', status: 'cancelled', danger: true },
  ],
  paid: [
    { label: 'Mark as Fulfilled', status: 'fulfilled' },
    { label: 'Cancel Order', status: 'cancelled', danger: true },
  ],
  fulfilled: [
    { label: 'Cancel Order', status: 'cancelled', danger: true },
    { label: 'Refunded', status: 'refunded' },
  ],
  cancelled: [],
  refunded: [],
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminOrderRoute() {
  const { order } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const transitions = STATUS_TRANSITIONS[order.status] ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
          <Link to="/admin/orders" className="hover:underline">
            Orders
          </Link>
          <span>/</span>
          <span className="font-mono text-xs">{order.orderNumber}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Order {order.orderNumber}
          </h1>
          <StatusBadge status={order.status} />
          <a
            href={`/admin/orders/${order.id}/documents`}
            className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Download Invoice
          </a>
          <span className="text-sm text-gray-500 dark:text-zinc-400">
            {new Date(order.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Action feedback */}
      {actionData?.ok && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
          Saved successfully.
        </div>
      )}
      {actionData?.error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {actionData.error}
        </div>
      )}

      {/* Status transitions */}
      {transitions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {transitions.map((t) => (
            <Form method="post" key={t.status}>
              <input type="hidden" name="intent" value="update-status" />
              <input type="hidden" name="status" value={t.status} />
              <button
                type="submit"
                disabled={isSubmitting}
                className={clsx(
                  'rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60',
                  t.danger
                    ? 'bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600'
                )}
              >
                {t.label}
              </button>
            </Form>
          ))}
        </div>
      )}

      {/* Line items */}
      <SectionCard title="Line Items">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-800">
                <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Item
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  SKU
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Qty
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Fulfilled
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Returned
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Unit Price
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {order.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                    {line.title}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-zinc-400">
                    {line.sku ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-zinc-300">
                    {line.quantity}
                  </td>
                  <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-zinc-300">
                    {line.fulfilledQuantity}
                  </td>
                  <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-zinc-300">
                    {line.returnedQuantity}
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-gray-700 dark:text-zinc-300">
                    {formatCents(line.priceCents, order.currency)}
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-medium text-gray-900 dark:text-white">
                    {formatCents(line.totalCents, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 dark:border-zinc-700">
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-2 text-right text-sm text-gray-500 dark:text-zinc-400"
                >
                  Subtotal
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-700 dark:text-zinc-300">
                  {formatCents(order.subtotalCents, order.currency)}
                </td>
              </tr>
              {order.shippingCents > 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-2 text-right text-sm text-gray-500 dark:text-zinc-400"
                  >
                    Shipping
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-gray-700 dark:text-zinc-300">
                    {formatCents(order.shippingCents, order.currency)}
                  </td>
                </tr>
              )}
              {order.taxCents > 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-2 text-right text-sm text-gray-500 dark:text-zinc-400"
                  >
                    Tax
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-gray-700 dark:text-zinc-300">
                    {formatCents(order.taxCents, order.currency)}
                  </td>
                </tr>
              )}
              {order.discountCents > 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-2 text-right text-sm text-gray-500 dark:text-zinc-400"
                  >
                    Discount
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-green-600 dark:text-green-400">
                    -{formatCents(order.discountCents, order.currency)}
                  </td>
                </tr>
              )}
              <tr className="border-t border-gray-200 dark:border-zinc-700">
                <td
                  colSpan={6}
                  className="px-3 py-2 text-right text-sm font-semibold text-gray-900 dark:text-white"
                >
                  Total
                </td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-gray-900 dark:text-white">
                  {formatCents(order.totalCents, order.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>

      {/* Payment info + Address (side by side on wider screens) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Payment info */}
        <SectionCard title="Payment">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-zinc-400">Provider</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {order.paymentProvider ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-zinc-400">Intent ID</dt>
              <dd className="max-w-[180px] truncate font-mono text-xs text-gray-700 dark:text-zinc-300">
                {order.paymentIntentId ?? '—'}
              </dd>
            </div>
            {order.couponCode && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-zinc-400">Coupon</dt>
                <dd className="font-mono text-xs text-gray-700 dark:text-zinc-300">
                  {order.couponCode}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-zinc-400">Currency</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {order.currency}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-zinc-400">Customer</dt>
              <dd className="text-gray-700 dark:text-zinc-300">
                {order.customer?.name
                  ? `${order.customer.name} (${order.email})`
                  : order.email}
              </dd>
            </div>
          </dl>
        </SectionCard>

        {/* Shipping address */}
        <SectionCard title="Shipping Address">
          <AddressDisplay json={order.shippingAddressJson} />
          {order.billingAddressJson && (
            <div className="mt-4">
              <AddressDisplay json={order.billingAddressJson} label="Billing" />
            </div>
          )}
        </SectionCard>
      </div>

      {/* Shipments */}
      <SectionCard title="Shipments">
        {order.shipments.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-zinc-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800">
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                    Carrier
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                    Tracking
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                    Shipped At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {order.shipments.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 text-gray-700 capitalize dark:text-zinc-300">
                      {s.status}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-zinc-300">
                      {s.carrier ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {s.trackingUrl ? (
                        <a
                          href={s.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {s.trackingNumber ?? s.trackingUrl}
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-gray-500 dark:text-zinc-400">
                          {s.trackingNumber ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-zinc-400">
                      {s.shippedAt
                        ? new Date(s.shippedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Partial fulfillment quantities */}
        {order.lines.some(
          (l) => l.fulfilledQuantity < l.quantity - l.returnedQuantity
        ) && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
              Ship quantities (partial fulfillment)
            </p>
            {order.lines
              .filter(
                (l) => l.fulfilledQuantity < l.quantity - l.returnedQuantity
              )
              .map((line) => (
                <div key={line.id} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 text-gray-700 dark:text-zinc-300">
                    {line.title}
                  </span>
                  <input
                    type="number"
                    name={`ship-qty-${line.id}`}
                    min={0}
                    max={
                      line.quantity -
                      line.fulfilledQuantity -
                      line.returnedQuantity
                    }
                    defaultValue={
                      line.quantity -
                      line.fulfilledQuantity -
                      line.returnedQuantity
                    }
                    className="w-20 rounded-md border-0 bg-white px-2 py-1 text-sm shadow-sm ring-1 ring-gray-300 ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
                  />
                </div>
              ))}
          </div>
        )}

        {/* Mark Shipped form */}
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="add-shipment" />
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            Add Shipment
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-zinc-400">
                Carrier
              </label>
              <input
                type="text"
                name="carrier"
                placeholder="UPS, FedEx…"
                className="w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-zinc-400">
                Tracking Number
              </label>
              <input
                type="text"
                name="trackingNumber"
                placeholder="1Z999…"
                className="w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-zinc-400">
                Tracking URL
              </label>
              <input
                type="url"
                name="trackingUrl"
                placeholder="https://…"
                className="w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
          >
            Mark Shipped
          </button>
        </Form>
      </SectionCard>

      {/* Returns */}
      <SectionCard title="Returns">
        {order.returns.length > 0 && (
          <div className="mb-4 space-y-4">
            {order.returns.map((ret) => (
              <div
                key={ret.id}
                className="rounded-md border border-gray-200 p-4 dark:border-zinc-700"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-500">
                    {ret.id.slice(-8)}
                  </span>
                  <span className="text-sm text-gray-700 capitalize dark:text-zinc-300">
                    {ret.status}
                    {ret.resolution ? ` (${ret.resolution})` : ''}
                  </span>
                </div>
                {ret.reason && (
                  <p className="mb-2 text-sm text-gray-600 dark:text-zinc-400">
                    {ret.reason}
                  </p>
                )}
                <ul className="mb-3 text-sm text-gray-700 dark:text-zinc-300">
                  {ret.lines.map((l) => (
                    <li key={l.id}>
                      {l.title} × {l.quantity}
                      {l.restocked ? ' (restocked)' : ''}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {ret.status === 'requested' && (
                    <Form method="post" className="inline">
                      <input
                        type="hidden"
                        name="intent"
                        value="approve-return"
                      />
                      <input type="hidden" name="returnId" value={ret.id} />
                      <input type="hidden" name="resolution" value="refund" />
                      <button
                        type="submit"
                        className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white"
                      >
                        Approve (Refund)
                      </button>
                    </Form>
                  )}
                  {ret.status === 'approved' && (
                    <Form method="post" className="inline">
                      <input
                        type="hidden"
                        name="intent"
                        value="receive-return"
                      />
                      <input type="hidden" name="returnId" value={ret.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white"
                      >
                        Mark Received
                      </button>
                    </Form>
                  )}
                  {ret.status === 'received' && (
                    <>
                      <Form method="post" className="inline">
                        <input
                          type="hidden"
                          name="intent"
                          value="complete-return"
                        />
                        <input type="hidden" name="returnId" value={ret.id} />
                        <input type="hidden" name="resolution" value="refund" />
                        <button
                          type="submit"
                          className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                        >
                          Issue Refund
                        </button>
                      </Form>
                      <Form method="post" className="inline">
                        <input
                          type="hidden"
                          name="intent"
                          value="complete-return"
                        />
                        <input type="hidden" name="returnId" value={ret.id} />
                        <input
                          type="hidden"
                          name="resolution"
                          value="store_credit"
                        />
                        <button
                          type="submit"
                          className="rounded-md bg-green-600 px-2 py-1 text-xs font-semibold text-white"
                        >
                          Issue Store Credit
                        </button>
                      </Form>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {order.returns.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            No returns for this order.
          </p>
        )}
      </SectionCard>

      {/* Refunds */}
      <SectionCard title="Refunds">
        {order.refunds.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-zinc-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800">
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                    Reason
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {order.refunds.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                      {formatCents(r.amountCents, order.currency)}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-zinc-300">
                      {r.reason ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700 capitalize dark:text-zinc-300">
                      {r.status}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-zinc-400">
                      {new Date(r.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Refund form */}
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="add-refund" />
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            Issue Refund
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-zinc-400">
                Amount (cents)
              </label>
              <input
                type="number"
                name="amountCents"
                min={1}
                placeholder="e.g. 1000 = $10.00"
                className="w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-zinc-400">
                Reason
              </label>
              <input
                type="text"
                name="reason"
                placeholder="Customer request, damaged item…"
                className="w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-60"
          >
            Create Refund
          </button>
        </Form>
      </SectionCard>

      {/* Notes */}
      <SectionCard title="Notes">
        {order.notes && (
          <p className="mb-4 text-sm whitespace-pre-wrap text-gray-700 dark:text-zinc-300">
            {order.notes}
          </p>
        )}
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="update-notes" />
          <textarea
            name="notes"
            defaultValue={order.notes}
            rows={4}
            placeholder="Internal notes about this order…"
            className="w-full rounded-md border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:placeholder:text-zinc-500"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
          >
            Save Notes
          </button>
        </Form>
      </SectionCard>
    </div>
  );
}
