// app/routes/admin/customers/$id.jsx
// Customer detail — header, edit form, addresses, order history.

import clsx from 'clsx';
import { Form, Link, useActionData, useLoaderData } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import { getAdminSlotBlocksMap } from '#/core/admin/slots/index.server';
import { recordAdminAudit } from '#/core/audit/index.server';
import { formatPrice } from '#/core/currency/format';
import {
  deleteAddress,
  getCustomer,
  getCustomerAdminDetail,
  setDefaultAddress,
  updateCustomer,
} from '#/core/customers/index.server';
import {
  exportCustomerData,
  eraseCustomer,
  getCustomerConsentSummary,
  parseUpdateConsentFormData,
  updateCustomerConsent,
} from '#/core/gdpr/index.server';
import { useT } from '#/core/i18n';
import {
  getCustomerStoreCreditSummary,
  issueStoreCredit,
  listLedgerEntries,
  parseIssueStoreCreditInput,
} from '#/core/store-credit/index.server';
import ActionBar from '#/components/admin/action-bar';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import { OrderStatusBadge } from '#/components/admin/order-status-badge';
import PageHeader from '#/components/admin/page-header';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';
import SlotBlocks from '#/components/slot-blocks';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ params }) {
  const { id } = params;

  const [
    customer,
    consentSummary,
    slotBlocks,
    storeCreditSummary,
    storeCreditLedger,
  ] = await Promise.all([
    getCustomerAdminDetail(id),
    getCustomerConsentSummary(id),
    getAdminSlotBlocksMap(['customer.detail']),
    getCustomerStoreCreditSummary(id),
    listLedgerEntries(id, { limit: 20 }),
  ]);

  if (!customer) {
    throw new Response('Not Found', { status: 404 });
  }

  return {
    slotBlocks,
    customer: {
      id: customer.id,
      email: customer.email,
      name: customer.name ?? null,
      phone: customer.phone ?? null,
      preferredLocale: customer.preferredLocale ?? null,
      createdAt: customer.createdAt.toISOString(),
      addresses: customer.addresses.map((a) => ({
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        company: a.company ?? null,
        line1: a.line1,
        line2: a.line2 ?? null,
        city: a.city,
        state: a.state ?? null,
        postalCode: a.postalCode ?? null,
        country: a.country,
        phone: a.phone ?? null,
        isDefault: a.isDefault,
      })),
      orders: customer.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        currency: o.currency,
        totalCents: o.totalCents,
        createdAt: o.createdAt.toISOString(),
      })),
      consent: consentSummary.consent,
      erasedAt: consentSummary.erasedAt,
    },
    storeCredit: {
      balanceCents: storeCreditSummary.balance,
      entries: storeCreditLedger.entries.map((entry) => ({
        id: entry.id,
        amountCents: entry.amountCents,
        balanceAfterCents: entry.balanceAfterCents,
        reason: entry.reason ?? null,
        referenceType: entry.referenceType ?? null,
        referenceId: entry.referenceId ?? null,
        createdAt: entry.createdAt.toISOString(),
      })),
      total: storeCreditLedger.total,
    },
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request, params }) {
  const { user } = await authenticate(request);
  const { id } = params;
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'update-customer') {
    const name = formData.get('name')?.toString().trim() || null;
    const phone = formData.get('phone')?.toString().trim() || null;
    const preferredLocale =
      formData.get('preferredLocale')?.toString().trim() || null;

    const before = await getCustomer(id);
    const beforeProfile = before
      ? {
          name: before.name,
          phone: before.phone,
          preferredLocale: before.preferredLocale,
        }
      : null;

    await updateCustomer(id, { name, phone, preferredLocale });

    await recordAdminAudit({
      user,
      action: 'customer.updated',
      entityType: 'customer',
      entityId: id,
      diff: {
        before: beforeProfile,
        after: { name, phone, preferredLocale },
      },
    });

    return { ok: true, intent };
  }

  if (intent === 'set-default-address') {
    const addressId = formData.get('addressId')?.toString();
    if (!addressId) return { ok: false, error: 'Missing addressId.' };

    await setDefaultAddress(addressId, id);

    await recordAdminAudit({
      user,
      action: 'customer.address.default_set',
      entityType: 'address',
      entityId: addressId,
      metadata: { customerId: id },
    });

    return { ok: true, intent };
  }

  if (intent === 'delete-address') {
    const addressId = formData.get('addressId')?.toString();
    if (!addressId) return { ok: false, error: 'Missing addressId.' };

    await deleteAddress(addressId, id);

    await recordAdminAudit({
      user,
      action: 'customer.address.deleted',
      entityType: 'address',
      entityId: addressId,
      metadata: { customerId: id },
    });

    return { ok: true, intent };
  }

  if (intent === 'issue-store-credit') {
    const input = parseIssueStoreCreditInput({
      amountCents: formData.get('amountCents'),
      reason: formData.get('reason'),
    });

    if (!input.amountCents || input.amountCents <= 0) {
      return { ok: false, error: 'Enter a credit amount greater than zero.' };
    }

    try {
      await issueStoreCredit(id, {
        ...input,
        referenceType: 'admin',
        referenceId: user.id,
      });

      await recordAdminAudit({
        user,
        action: 'customer.store_credit.issued',
        entityType: 'customer',
        entityId: id,
        metadata: {
          amountCents: input.amountCents,
          reason: input.reason,
        },
      });

      return { ok: true, intent };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (intent === 'update-consent') {
    const consents = parseUpdateConsentFormData(formData);
    await updateCustomerConsent(id, consents);
    await recordAdminAudit({
      user,
      action: 'customer.consent.updated',
      entityType: 'customer',
      entityId: id,
      metadata: consents,
    });
    return { ok: true, intent };
  }

  if (intent === 'export-data') {
    const data = await exportCustomerData(id);
    await recordAdminAudit({
      user,
      action: 'customer.data_exported',
      entityType: 'customer',
      entityId: id,
    });
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="customer-${id}-export.json"`,
      },
    });
  }

  if (intent === 'erase-customer') {
    try {
      const result = await eraseCustomer(id);
      await recordAdminAudit({
        user,
        action: 'customer.erased',
        entityType: 'customer',
        entityId: id,
        metadata: { anonymizedEmail: result.anonymizedEmail },
      });
      return { ok: true, intent, erased: true };
    } catch (err) {
      return { ok: false, error: err.message };
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
 * @param {import('react').ReactNode} props.children
 */
function SectionCard({ title, description, children }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminCustomerRoute() {
  const t = useT();
  const { customer, slotBlocks, storeCredit } = useLoaderData();
  const actionData = useActionData();

  const joinedDate = new Date(customer.createdAt).toLocaleDateString('en-US', {
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
                label: t('admin.customers.detail.breadcrumb'),
                href: '/admin/customers',
              },
              { label: customer.name || customer.email },
            ]}
          />
        }
        title={customer.name ?? customer.email}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {customer.name && <span>{customer.email}</span>}
            <span>
              {t('admin.customers.detail.joined', { date: joinedDate })}
            </span>
          </span>
        }
      />

      <SlotBlocks
        blocks={slotBlocks['customer.detail'] ?? []}
        slotProps={{ customer }}
      />

      {/* Action feedback */}
      {actionData?.ok && (
        <SuccessAlert message={t('admin.customers.detail.saved')} />
      )}
      <ErrorAlert message={actionData?.error} />

      {/* Edit Customer */}
      <SectionCard
        title={t('admin.customers.detail.detailsTitle')}
        description={t('admin.customers.detail.detailsDescription')}
      >
        <Form method="post" className="space-y-6">
          <input type="hidden" name="intent" value="update-customer" />

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('admin.customers.detail.name')}>
              <Input
                type="text"
                name="name"
                defaultValue={customer.name ?? ''}
                placeholder={t('admin.customers.detail.namePlaceholder')}
              />
            </Field>

            <Field label={t('admin.customers.detail.phone')}>
              <Input
                type="tel"
                name="phone"
                defaultValue={customer.phone ?? ''}
                placeholder={t('admin.customers.detail.phonePlaceholder')}
              />
            </Field>

            <Field label={t('admin.customers.detail.preferredLocale')}>
              <Input
                type="text"
                name="preferredLocale"
                defaultValue={customer.preferredLocale ?? ''}
                placeholder={t(
                  'admin.customers.detail.preferredLocalePlaceholder'
                )}
              />
            </Field>

            <Field
              label={t('admin.customers.detail.emailReadonly')}
              className="sm:col-span-2"
            >
              <p className="bg-surface-2 border-border text-text-muted rounded-md border px-3 py-1.5 text-sm">
                {customer.email}
              </p>
            </Field>
          </div>

          <ActionBar className="-mx-4 mt-6 rounded-none border-x-0 border-b-0 sm:-mx-6">
            <span />
            <ButtonSubmit>
              {t('admin.customers.detail.saveChanges')}
            </ButtonSubmit>
          </ActionBar>
        </Form>
      </SectionCard>

      {/* Addresses */}
      <SectionCard
        title={t('admin.customers.detail.addressesTitle', {
          count: customer.addresses.length,
        })}
        description={t('admin.customers.detail.addressesDescription')}
      >
        {customer.addresses.length === 0 ? (
          <p className="text-text-muted text-sm">
            {t('admin.customers.detail.noAddresses')}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {customer.addresses.map((addr) => (
              <div
                key={addr.id}
                className={clsx(
                  'relative rounded-lg border p-4',
                  addr.isDefault
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-surface-2'
                )}
              >
                {addr.isDefault && (
                  <Badge tone="accent" className="absolute top-3 right-3">
                    {t('admin.customers.detail.defaultBadge')}
                  </Badge>
                )}

                <address className="text-text text-sm not-italic">
                  <p className="font-medium">
                    {addr.firstName} {addr.lastName}
                  </p>
                  {addr.company && (
                    <p className="text-text-muted">{addr.company}</p>
                  )}
                  <p>{addr.line1}</p>
                  {addr.line2 && <p>{addr.line2}</p>}
                  <p>
                    {[addr.city, addr.state, addr.postalCode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  <p>{addr.country}</p>
                  {addr.phone && (
                    <p className="text-text-muted mt-1">{addr.phone}</p>
                  )}
                </address>

                <div className="mt-3 flex gap-2">
                  {!addr.isDefault && (
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="set-default-address"
                      />
                      <input type="hidden" name="addressId" value={addr.id} />
                      <Button type="submit" variant="secondary">
                        {t('admin.customers.detail.setDefault')}
                      </Button>
                    </Form>
                  )}
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete-address" />
                    <input type="hidden" name="addressId" value={addr.id} />
                    <Button
                      type="submit"
                      variant="danger"
                      onClick={(e) => {
                        if (
                          !confirm(
                            t('admin.customers.detail.confirmDeleteAddress')
                          )
                        )
                          e.preventDefault();
                      }}
                    >
                      {t('admin.customers.detail.delete')}
                    </Button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Store credit */}
      <SectionCard
        title={t('admin.customers.detail.storeCreditTitle')}
        description={t('admin.customers.detail.storeCreditDescription')}
      >
        <div className="border-border bg-surface-2 mb-6 rounded-lg border p-4">
          <p className="text-text-muted text-sm">
            {t('admin.customers.detail.currentBalance')}
          </p>
          <p className="text-text text-2xl font-semibold">
            {formatPrice(storeCredit.balanceCents)}
          </p>
        </div>

        {!customer.erasedAt && (
          <Form
            method="post"
            className="mb-6 grid gap-4 sm:grid-cols-[1fr_2fr_auto]"
          >
            <input type="hidden" name="intent" value="issue-store-credit" />
            <Field label={t('admin.customers.detail.amountCents')}>
              <Input
                type="number"
                name="amountCents"
                min="1"
                step="1"
                placeholder={t('admin.customers.detail.amountPlaceholder')}
                required
              />
            </Field>
            <Field label={t('admin.customers.detail.reason')}>
              <Input
                type="text"
                name="reason"
                placeholder={t('admin.customers.detail.reasonPlaceholder')}
              />
            </Field>
            <div className="flex items-end">
              <ButtonSubmit>
                {t('admin.customers.detail.issueCredit')}
              </ButtonSubmit>
            </div>
          </Form>
        )}

        {storeCredit.entries.length === 0 ? (
          <p className="text-text-muted text-sm">
            {t('admin.customers.detail.noLedger')}
          </p>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>{t('admin.customers.detail.col.date')}</Th>
                <Th>{t('admin.customers.detail.col.reason')}</Th>
                <Th className="text-right">
                  {t('admin.customers.detail.col.amount')}
                </Th>
                <Th className="text-right">
                  {t('admin.customers.detail.col.balance')}
                </Th>
              </tr>
            </THead>
            <TBody>
              {storeCredit.entries.map((entry) => (
                <tr key={entry.id}>
                  <Td>
                    {new Date(entry.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Td>
                  <Td>
                    {entry.reason ??
                      entry.referenceType ??
                      t('admin.customers.detail.adjustment')}
                  </Td>
                  <Td
                    className={clsx(
                      'text-right font-medium',
                      entry.amountCents >= 0 ? 'text-success' : 'text-danger'
                    )}
                  >
                    {entry.amountCents >= 0 ? '+' : ''}
                    {formatPrice(entry.amountCents)}
                  </Td>
                  <Td className="text-text text-right">
                    {formatPrice(entry.balanceAfterCents)}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </SectionCard>

      {/* GDPR & Privacy */}
      <SectionCard
        title={t('admin.customers.detail.gdprTitle')}
        description={t('admin.customers.detail.gdprDescription')}
      >
        {customer.erasedAt ? (
          <p className="text-warn text-sm">
            {t('admin.customers.detail.erased', {
              date: new Date(customer.erasedAt).toLocaleString('en'),
            })}
          </p>
        ) : (
          <div className="space-y-4">
            <Form method="post" className="flex flex-wrap items-center gap-4">
              <input type="hidden" name="intent" value="update-consent" />
              <label className="text-text flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="analytics"
                  defaultChecked={customer.consent.analytics}
                />
                {t('admin.customers.detail.analyticsConsent')}
              </label>
              <label className="text-text flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="marketing"
                  defaultChecked={customer.consent.marketing}
                />
                {t('admin.customers.detail.marketingConsent')}
              </label>
              <Button type="submit" variant="primary">
                {t('admin.customers.detail.saveConsent')}
              </Button>
            </Form>

            <div className="border-border flex flex-wrap gap-3 border-t pt-4">
              <Form method="post">
                <input type="hidden" name="intent" value="export-data" />
                <Button type="submit" variant="secondary">
                  {t('admin.customers.detail.exportData')}
                </Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="erase-customer" />
                <Button
                  type="submit"
                  variant="danger"
                  onClick={(e) => {
                    if (!confirm(t('admin.customers.detail.confirmErase'))) {
                      e.preventDefault();
                    }
                  }}
                >
                  {t('admin.customers.detail.eraseData')}
                </Button>
              </Form>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Order History */}
      <SectionCard
        title={t('admin.customers.detail.orderHistoryTitle')}
        description={t('admin.customers.detail.orderHistoryDescription')}
      >
        {customer.orders.length === 0 ? (
          <p className="text-text-muted text-sm">
            {t('admin.customers.detail.noOrders')}
          </p>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>{t('admin.customers.detail.col.order')}</Th>
                <Th>{t('admin.customers.detail.col.status')}</Th>
                <Th className="text-right">
                  {t('admin.customers.detail.col.total')}
                </Th>
                <Th>{t('admin.customers.detail.col.date')}</Th>
              </tr>
            </THead>
            <TBody>
              {customer.orders.map((order) => (
                <tr key={order.id}>
                  <Td>
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="text-accent font-mono text-sm font-medium hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </Td>
                  <Td>
                    <OrderStatusBadge status={order.status} />
                  </Td>
                  <Td className="text-text text-right">
                    {formatPrice(order.totalCents, order.currency)}
                  </Td>
                  <Td>
                    {new Date(order.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
