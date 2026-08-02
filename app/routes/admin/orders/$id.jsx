// app/routes/admin/orders/$id.jsx
// Order detail — line items, payment info, address, shipments, refunds,
// manual notes, and status transitions.

import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui/index.server';
import { getAdminSlotBlocksMap } from '#/core/admin/slots/index.server';
import { formatPrice } from '#/core/currency/format';
import { useT } from '#/core/i18n';
import {
  addShipment,
  markDelivered,
  markShipped,
} from '#/core/orders/fulfillment.server';
import {
  loadOrderAdminDetailData,
  transitionOrderStatus,
  updateOrderNotes,
} from '#/core/orders/index.server';
import { createRefund } from '#/core/orders/refunds.server';
import {
  approveReturn,
  cancelReturn,
  completeReturn,
  receiveReturn,
} from '#/core/returns/index.server';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import { controlClasses } from '#/components/admin/form/input';
import { OrderStatusBadge } from '#/components/admin/order-status-badge';
import PageHeader from '#/components/admin/page-header';
import { Td, Th } from '#/components/admin/table';
import SlotBlocks from '#/components/slot-blocks';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ params }) {
  const { id } = params;

  const [order, slotBlocks] = await Promise.all([
    loadOrderAdminDetailData(id),
    getAdminSlotBlocksMap(['order.detail']),
  ]);

  if (!order) {
    throw new Response('Not Found', { status: 404 });
  }

  return { slotBlocks, order };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request, params }) {
  const { id } = params;
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'update-status') {
    const newStatus = formData.get('status');
    try {
      await transitionOrderStatus(id, newStatus);
      return { ok: true, intent };
    } catch (err) {
      if (err?.code === 'INVALID_ORDER_STATUS_TRANSITION') {
        return { ok: false, error: 'Invalid status transition.' };
      }
      return handleAdminActionError(err, {
        source: 'admin.orders.update-status',
        intent,
        userMessage: 'Could not update order status.',
      });
    }
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
      const shipment = await addShipment(id, {
        carrier,
        trackingNumber,
        trackingUrl,
        lines: lines.length > 0 ? lines : undefined,
      });
      await markShipped(shipment.id, {
        carrier,
        trackingNumber,
        trackingUrl,
      });
      return { ok: true, intent };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.orders.add-shipment',
        intent,
        userMessage: 'Could not add shipment.',
      });
    }
  }

  if (intent === 'mark-delivered') {
    const shipmentId = formData.get('shipmentId')?.toString();
    if (!shipmentId) return { ok: false, error: 'Missing shipmentId' };
    try {
      await markDelivered(shipmentId);
      return { ok: true, intent };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.orders.mark-delivered',
        intent,
        userMessage: 'Could not mark shipment delivered.',
      });
    }
  }

  if (intent === 'add-refund') {
    const amountCents = parseInt(formData.get('amountCents') ?? '0', 10);
    const reason = formData.get('reason')?.toString().trim() || null;

    try {
      await createRefund(id, { amountCents, reason });
      return { ok: true, intent };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.orders.add-refund',
        intent,
        userMessage: 'Could not create refund.',
      });
    }
  }

  if (intent === 'approve-return') {
    const returnId = formData.get('returnId')?.toString();
    const resolution = formData.get('resolution')?.toString() || 'refund';
    try {
      await approveReturn(returnId, { resolution });
      return { ok: true, intent };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.orders.approve-return',
        intent,
        userMessage: 'Could not approve return.',
      });
    }
  }

  if (intent === 'receive-return') {
    const returnId = formData.get('returnId')?.toString();
    try {
      await receiveReturn(returnId);
      return { ok: true, intent };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.orders.receive-return',
        intent,
        userMessage: 'Could not receive return.',
      });
    }
  }

  if (intent === 'complete-return') {
    const returnId = formData.get('returnId')?.toString();
    const resolution = formData.get('resolution')?.toString() || undefined;
    try {
      await completeReturn(returnId, { resolution });
      return { ok: true, intent };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.orders.complete-return',
        intent,
        userMessage: 'Could not complete return.',
      });
    }
  }

  if (intent === 'cancel-return') {
    const returnId = formData.get('returnId')?.toString();
    try {
      await cancelReturn(returnId);
      return { ok: true, intent };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.orders.cancel-return',
        intent,
        userMessage: 'Could not cancel return.',
      });
    }
  }

  if (intent === 'update-notes') {
    const notes = formData.get('notes')?.toString() ?? '';
    try {
      await updateOrderNotes(id, notes);
      return { ok: true, intent };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.orders.update-notes',
        intent,
        userMessage: 'Could not update notes.',
      });
    }
  }

  return { ok: false, error: 'Unknown intent.' };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} props.children
 */
function SectionCard({ title, description, children }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {children}
    </Card>
  );
}

/**
 * @param {Object} props
 * @param {string|null|undefined} props.json
 * @param {string} [props.label]
 * @param {(key: string, vars?: Record<string, string|number>) => string} props.t
 */
function AddressDisplay({ json, label, t }) {
  if (!json) return null;
  let addr;
  try {
    addr = JSON.parse(json);
  } catch {
    return (
      <p className="text-text-muted text-sm">
        {t('admin.orders.detail.invalidJson', { label: label ?? '' })}
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
        <p className="text-text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
          {label}
        </p>
      )}
      <address className="text-text text-sm not-italic">
        {lines.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </address>
    </div>
  );
}

/** @typedef {{ labelKey: string, status: string, danger?: boolean }} StatusTransition */

/** @type {Record<string, StatusTransition[]>} */
const STATUS_TRANSITIONS = {
  pending: [{ labelKey: 'admin.orders.detail.markAsPaid', status: 'paid' }],
  pending_payment: [
    { labelKey: 'admin.orders.detail.confirmPayment', status: 'paid' },
    {
      labelKey: 'admin.orders.detail.cancelOrder',
      status: 'cancelled',
      danger: true,
    },
  ],
  paid: [
    { labelKey: 'admin.orders.detail.markAsFulfilled', status: 'fulfilled' },
    {
      labelKey: 'admin.orders.detail.cancelOrder',
      status: 'cancelled',
      danger: true,
    },
  ],
  fulfilled: [
    {
      labelKey: 'admin.orders.detail.cancelOrder',
      status: 'cancelled',
      danger: true,
    },
    { labelKey: 'admin.orders.detail.markRefunded', status: 'refunded' },
  ],
  cancelled: [],
  refunded: [],
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminOrderRoute() {
  const t = useT();
  const { order, slotBlocks } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const transitions = STATUS_TRANSITIONS[order.status] ?? [];

  const createdDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.orders.detail.breadcrumb'),
                href: '/admin/orders',
              },
              { label: order.orderNumber },
            ]}
          />
        }
        title={t('admin.orders.detail.title', { number: order.orderNumber })}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span>
              {t('admin.orders.detail.placed', { date: createdDate })}
            </span>
          </span>
        }
        actions={
          <a
            href={`/admin/orders/${order.id}/documents`}
            className="border-border bg-surface-2 text-text hover:bg-surface inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium shadow-xs transition"
          >
            {t('admin.orders.detail.downloadInvoice')}
          </a>
        }
      />

      <SlotBlocks
        blocks={slotBlocks['order.detail'] ?? []}
        slotProps={{ order }}
      />

      {/* Action feedback */}
      {actionData?.ok && (
        <SuccessAlert message={t('admin.orders.detail.saved')} />
      )}
      {actionData?.error && <ErrorAlert message={actionData.error} />}

      {/* Status transitions */}
      {transitions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {transitions.map((transition) => (
            <Form method="post" key={transition.status}>
              <input type="hidden" name="intent" value="update-status" />
              <input type="hidden" name="status" value={transition.status} />
              <ButtonSubmit
                variant={transition.danger ? 'danger' : 'primary'}
                disabled={isSubmitting}
              >
                {t(transition.labelKey)}
              </ButtonSubmit>
            </Form>
          ))}
        </div>
      )}

      {/* Line items */}
      <SectionCard
        title={t('admin.orders.detail.lineItems')}
        description={t('admin.orders.detail.lineItemsDesc')}
      >
        <div className="overflow-x-auto">
          <table className="divide-border min-w-full divide-y">
            <thead className="bg-surface-2/50">
              <tr>
                <Th>{t('admin.orders.detail.col.item')}</Th>
                <Th>{t('admin.orders.detail.col.sku')}</Th>
                <Th className="text-center">
                  {t('admin.orders.detail.col.qty')}
                </Th>
                <Th className="text-center">
                  {t('admin.orders.detail.col.fulfilled')}
                </Th>
                <Th className="text-center">
                  {t('admin.orders.detail.col.returned')}
                </Th>
                <Th className="text-right">
                  {t('admin.orders.detail.col.unitPrice')}
                </Th>
                <Th className="text-right">
                  {t('admin.orders.detail.col.total')}
                </Th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {order.lines.map((line) => (
                <tr key={line.id}>
                  <Td className="text-text">{line.title}</Td>
                  <Td className="font-mono text-xs">{line.sku ?? '—'}</Td>
                  <Td className="text-text text-center">{line.quantity}</Td>
                  <Td className="text-text text-center">
                    {line.fulfilledQuantity}
                  </Td>
                  <Td className="text-text text-center">
                    {line.returnedQuantity}
                  </Td>
                  <Td className="text-text text-right">
                    {formatPrice(line.priceCents, order.currency)}
                  </Td>
                  <Td className="text-text text-right font-medium">
                    {formatPrice(line.totalCents, order.currency)}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-border border-t">
              <tr>
                <Td colSpan={6} className="text-right">
                  {t('admin.orders.detail.subtotal')}
                </Td>
                <Td className="text-text text-right">
                  {formatPrice(order.subtotalCents, order.currency)}
                </Td>
              </tr>
              {order.shippingCents > 0 && (
                <tr>
                  <Td colSpan={6} className="text-right">
                    {t('admin.orders.detail.shipping')}
                  </Td>
                  <Td className="text-text text-right">
                    {formatPrice(order.shippingCents, order.currency)}
                  </Td>
                </tr>
              )}
              {order.taxCents > 0 && (
                <tr>
                  <Td colSpan={6} className="text-right">
                    {t('admin.orders.detail.tax')}
                  </Td>
                  <Td className="text-text text-right">
                    {formatPrice(order.taxCents, order.currency)}
                  </Td>
                </tr>
              )}
              {order.discountCents > 0 && (
                <tr>
                  <Td colSpan={6} className="text-right">
                    {t('admin.orders.detail.discount')}
                  </Td>
                  <Td className="text-success text-right">
                    -{formatPrice(order.discountCents, order.currency)}
                  </Td>
                </tr>
              )}
              <tr className="border-border border-t">
                <Td colSpan={6} className="text-text text-right font-semibold">
                  {t('admin.orders.detail.total')}
                </Td>
                <Td className="text-text text-right font-semibold">
                  {formatPrice(order.totalCents, order.currency)}
                </Td>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>

      {/* Payment info + Address (side by side on wider screens) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Payment info */}
        <SectionCard
          title={t('admin.orders.detail.payment')}
          description={t('admin.orders.detail.paymentDesc')}
        >
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">
                {t('admin.orders.detail.provider')}
              </dt>
              <dd className="text-text font-medium">
                {order.paymentProvider ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">
                {t('admin.orders.detail.intentId')}
              </dt>
              <dd className="text-text max-w-[180px] truncate font-mono text-xs">
                {order.paymentIntentId ?? '—'}
              </dd>
            </div>
            {order.couponCode && (
              <div className="flex justify-between">
                <dt className="text-text-muted">
                  {t('admin.orders.detail.coupon')}
                </dt>
                <dd className="text-text font-mono text-xs">
                  {order.couponCode}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-text-muted">
                {t('admin.orders.detail.currency')}
              </dt>
              <dd className="text-text font-medium">{order.currency}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">
                {t('admin.orders.detail.customer')}
              </dt>
              <dd className="text-text">
                {order.customer?.name
                  ? `${order.customer.name} (${order.email})`
                  : order.email}
              </dd>
            </div>
          </dl>
        </SectionCard>

        {/* Shipping address */}
        <SectionCard
          title={t('admin.orders.detail.shippingAddress')}
          description={t('admin.orders.detail.shippingAddressDesc')}
        >
          <AddressDisplay json={order.shippingAddressJson} t={t} />
          {order.billingAddressJson && (
            <div className="mt-4">
              <AddressDisplay
                json={order.billingAddressJson}
                label={t('admin.orders.detail.billing')}
                t={t}
              />
            </div>
          )}
        </SectionCard>
      </div>

      {/* Shipments */}
      <SectionCard
        title={t('admin.orders.detail.shipments')}
        description={t('admin.orders.detail.shipmentsDesc')}
      >
        {order.shipments.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="divide-border min-w-full divide-y text-sm">
              <thead className="bg-surface-2/50">
                <tr>
                  <Th>{t('admin.orders.detail.col.status')}</Th>
                  <Th>{t('admin.orders.detail.col.carrier')}</Th>
                  <Th>{t('admin.orders.detail.col.tracking')}</Th>
                  <Th>{t('admin.orders.detail.col.shippedAt')}</Th>
                  <Th>{t('admin.orders.detail.col.documents')}</Th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {order.shipments.map((s) => (
                  <tr key={s.id}>
                    <Td className="text-text capitalize">{s.status}</Td>
                    <Td className="text-text">{s.carrier ?? '—'}</Td>
                    <Td>
                      {s.trackingUrl ? (
                        <a
                          href={s.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent font-mono text-xs hover:underline"
                        >
                          {s.trackingNumber ?? s.trackingUrl}
                        </a>
                      ) : (
                        <span className="font-mono text-xs">
                          {s.trackingNumber ?? '—'}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {s.shippedAt
                        ? new Date(s.shippedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </Td>
                    <Td>
                      <a
                        href={`/admin/shipments/${s.id}/documents`}
                        className="text-accent text-xs font-medium hover:underline"
                      >
                        {t('admin.orders.detail.packingSlip')}
                      </a>
                    </Td>
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
            <p className="text-text-muted text-xs font-medium">
              {t('admin.orders.detail.shipQuantities')}
            </p>
            {order.lines
              .filter(
                (l) => l.fulfilledQuantity < l.quantity - l.returnedQuantity
              )
              .map((line) => (
                <div key={line.id} className="flex items-center gap-3 text-sm">
                  <span className="text-text flex-1">{line.title}</span>
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
                    className={`${controlClasses} w-20`}
                  />
                </div>
              ))}
          </div>
        )}

        {/* Mark Shipped form */}
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="add-shipment" />
          <p className="text-text text-sm font-medium">
            {t('admin.orders.detail.addShipment')}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-text-muted mb-1 block text-xs">
                {t('admin.orders.detail.carrier')}
              </label>
              <input
                type="text"
                name="carrier"
                placeholder={t('admin.orders.detail.carrierPlaceholder')}
                className={controlClasses}
              />
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs">
                {t('admin.orders.detail.trackingNumber')}
              </label>
              <input
                type="text"
                name="trackingNumber"
                placeholder={t('admin.orders.detail.trackingNumberPlaceholder')}
                className={controlClasses}
              />
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs">
                {t('admin.orders.detail.trackingUrl')}
              </label>
              <input
                type="url"
                name="trackingUrl"
                placeholder={t('admin.orders.detail.trackingUrlPlaceholder')}
                className={controlClasses}
              />
            </div>
          </div>
          <ButtonSubmit disabled={isSubmitting}>
            {t('admin.orders.detail.markShipped')}
          </ButtonSubmit>
        </Form>
      </SectionCard>

      {/* Returns */}
      <SectionCard
        title={t('admin.orders.detail.returns')}
        description={t('admin.orders.detail.returnsDesc')}
      >
        {order.returns.length > 0 && (
          <div className="mb-4 space-y-4">
            {order.returns.map((ret) => (
              <div key={ret.id} className="border-border rounded-md border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-text-muted font-mono text-xs">
                    {ret.id.slice(-8)}
                  </span>
                  <span className="text-text text-sm capitalize">
                    {ret.status}
                    {ret.resolution ? ` (${ret.resolution})` : ''}
                  </span>
                </div>
                {ret.reason && (
                  <p className="text-text-muted mb-2 text-sm">{ret.reason}</p>
                )}
                <ul className="text-text mb-3 text-sm">
                  {ret.lines.map((l) => (
                    <li key={l.id}>
                      {l.title} × {l.quantity}
                      {l.restocked
                        ? ` ${t('admin.orders.detail.restocked')}`
                        : ''}
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
                      <Button type="submit" variant="primary">
                        {t('admin.orders.detail.approveRefund')}
                      </Button>
                    </Form>
                  )}
                  {(ret.status === 'requested' ||
                    ret.status === 'approved') && (
                    <Form method="post" className="inline">
                      <input
                        type="hidden"
                        name="intent"
                        value="cancel-return"
                      />
                      <input type="hidden" name="returnId" value={ret.id} />
                      <Button type="submit" variant="secondary">
                        {t('common.cancel')}
                      </Button>
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
                      <Button type="submit" variant="primary">
                        {t('admin.orders.detail.markReceived')}
                      </Button>
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
                        <Button type="submit" variant="danger">
                          {t('admin.orders.detail.issueRefund')}
                        </Button>
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
                        <Button type="submit" variant="primary">
                          {t('admin.orders.detail.issueStoreCredit')}
                        </Button>
                      </Form>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {order.returns.length === 0 && (
          <p className="text-text-muted text-sm">
            {t('admin.orders.detail.noReturns')}
          </p>
        )}
      </SectionCard>

      {/* Refunds */}
      <SectionCard
        title={t('admin.orders.detail.refunds')}
        description={t('admin.orders.detail.refundsDesc')}
      >
        {order.refunds.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="divide-border min-w-full divide-y text-sm">
              <thead className="bg-surface-2/50">
                <tr>
                  <Th>{t('admin.orders.detail.col.amount')}</Th>
                  <Th>{t('admin.orders.detail.col.reason')}</Th>
                  <Th>{t('admin.orders.detail.col.status')}</Th>
                  <Th>{t('admin.orders.detail.col.date')}</Th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {order.refunds.map((r) => (
                  <tr key={r.id}>
                    <Td className="text-text font-medium">
                      {formatPrice(r.amountCents, order.currency)}
                    </Td>
                    <Td className="text-text">{r.reason ?? '—'}</Td>
                    <Td className="text-text capitalize">{r.status}</Td>
                    <Td>
                      {new Date(r.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Refund form */}
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="add-refund" />
          <p className="text-text text-sm font-medium">
            {t('admin.orders.detail.issueRefundHeading')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-text-muted mb-1 block text-xs">
                {t('admin.orders.detail.amountCents')}
              </label>
              <input
                type="number"
                name="amountCents"
                min={1}
                placeholder={t('admin.orders.detail.amountCentsPlaceholder')}
                className={controlClasses}
              />
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs">
                {t('admin.orders.detail.reason')}
              </label>
              <input
                type="text"
                name="reason"
                placeholder={t('admin.orders.detail.reasonPlaceholder')}
                className={controlClasses}
              />
            </div>
          </div>
          <ButtonSubmit variant="danger" disabled={isSubmitting}>
            {t('admin.orders.detail.createRefund')}
          </ButtonSubmit>
        </Form>
      </SectionCard>

      {/* Notes */}
      <SectionCard
        title={t('admin.orders.detail.notes')}
        description={t('admin.orders.detail.notesDesc')}
      >
        {order.notes && (
          <p className="text-text mb-4 text-sm whitespace-pre-wrap">
            {order.notes}
          </p>
        )}
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="update-notes" />
          <textarea
            name="notes"
            defaultValue={order.notes}
            rows={4}
            placeholder={t('admin.orders.detail.notesPlaceholder')}
            className={controlClasses}
          />
          <ButtonSubmit disabled={isSubmitting}>
            {t('admin.orders.detail.saveNotes')}
          </ButtonSubmit>
        </Form>
      </SectionCard>
    </div>
  );
}
