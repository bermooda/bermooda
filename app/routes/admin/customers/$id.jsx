// app/routes/admin/customers/$id.jsx
// Customer detail — header, edit form, addresses, order history.

import clsx from 'clsx';
import { Form, Link, useActionData, useLoaderData } from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';
import prisma from '#/libs/prisma.server';
import { getAdminSlotBlocksMap } from '#/core/admin/slots.server';
import { recordAdminAudit } from '#/core/audit/index.server';
import {
  deleteAddress,
  setDefaultAddress,
  updateCustomer,
} from '#/core/customers/index.server';
import {
  exportCustomerData,
  eraseCustomer,
  updateCustomerConsent,
  parseConsent,
} from '#/core/gdpr/index.server';
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
import PageHeader from '#/components/admin/page-header';
import SlotBlocks from '#/components/admin/slot-blocks';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ params }) {
  const { id } = params;

  const [customer, slotBlocks, storeCreditSummary, storeCreditLedger] =
    await Promise.all([
      prisma.customer.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          preferredLocale: true,
          consentJson: true,
          erasedAt: true,
          createdAt: true,
          addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true,
              orderNumber: true,
              status: true,
              currency: true,
              totalCents: true,
              createdAt: true,
            },
          },
        },
      }),
      getAdminSlotBlocksMap(['customer.detail']),
      getCustomerStoreCreditSummary(id),
      listLedgerEntries(id, { limit: 20 }),
    ]);

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
      consent: parseConsent(customer.consentJson),
      erasedAt: customer.erasedAt?.toISOString() ?? null,
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

    const before = await prisma.customer.findUnique({
      where: { id },
      select: { name: true, phone: true, preferredLocale: true },
    });

    await updateCustomer(id, { name, phone, preferredLocale });

    await recordAdminAudit({
      user,
      action: 'customer.updated',
      entityType: 'customer',
      entityId: id,
      diff: { before, after: { name, phone, preferredLocale } },
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
    const analytics = formData.get('analytics') === 'on';
    const marketing = formData.get('marketing') === 'on';
    await updateCustomerConsent(id, { analytics, marketing });
    await recordAdminAudit({
      user,
      action: 'customer.consent.updated',
      entityType: 'customer',
      entityId: id,
      metadata: { analytics, marketing },
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

const STATUS_TONES = {
  pending: 'warn',
  pending_payment: 'warn',
  paid: 'accent',
  fulfilled: 'success',
  cancelled: 'danger',
  refunded: 'neutral',
};

function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{status}</Badge>;
}

function formatCents(cents, currency = 'USD') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

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
              { label: 'Customers', href: '/admin/customers' },
              { label: customer.name || customer.email },
            ]}
          />
        }
        title={customer.name ?? customer.email}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {customer.name && <span>{customer.email}</span>}
            <span>Joined {joinedDate}</span>
          </span>
        }
      />

      <SlotBlocks
        blocks={slotBlocks['customer.detail'] ?? []}
        slotProps={{ customer }}
      />

      {/* Action feedback */}
      {actionData?.ok && <SuccessAlert message="Saved successfully." />}
      <ErrorAlert message={actionData?.error} />

      {/* Edit Customer */}
      <SectionCard
        title="Customer details"
        description="Update profile information for this customer."
      >
        <Form method="post" className="space-y-6">
          <input type="hidden" name="intent" value="update-customer" />

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name">
              <Input
                type="text"
                name="name"
                defaultValue={customer.name ?? ''}
                placeholder="Jane Doe"
              />
            </Field>

            <Field label="Phone">
              <Input
                type="tel"
                name="phone"
                defaultValue={customer.phone ?? ''}
                placeholder="+1 555 000 0000"
              />
            </Field>

            <Field label="Preferred locale">
              <Input
                type="text"
                name="preferredLocale"
                defaultValue={customer.preferredLocale ?? ''}
                placeholder="en, de, fr…"
              />
            </Field>

            <Field label="Email (read-only)" className="sm:col-span-2">
              <p className="bg-surface-2 border-border text-text-muted rounded-md border px-3 py-1.5 text-sm">
                {customer.email}
              </p>
            </Field>
          </div>

          <ActionBar className="-mx-4 mt-6 rounded-none border-x-0 border-b-0 sm:-mx-6">
            <span />
            <ButtonSubmit>Save changes</ButtonSubmit>
          </ActionBar>
        </Form>
      </SectionCard>

      {/* Addresses */}
      <SectionCard
        title={`Addresses (${customer.addresses.length})`}
        description="Saved shipping and billing addresses."
      >
        {customer.addresses.length === 0 ? (
          <p className="text-text-muted text-sm">No addresses saved.</p>
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
                    Default
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
                        Set Default
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
                        if (!confirm('Delete this address?'))
                          e.preventDefault();
                      }}
                    >
                      Delete
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
        title="Store credit"
        description="Issue credit redeemable at checkout. Returns and refunds may also add credit automatically."
      >
        <div className="border-border bg-surface-2 mb-6 rounded-lg border p-4">
          <p className="text-text-muted text-sm">Current balance</p>
          <p className="text-text text-2xl font-semibold">
            {formatCents(storeCredit.balanceCents)}
          </p>
        </div>

        {!customer.erasedAt && (
          <Form
            method="post"
            className="mb-6 grid gap-4 sm:grid-cols-[1fr_2fr_auto]"
          >
            <input type="hidden" name="intent" value="issue-store-credit" />
            <Field label="Amount (USD cents)">
              <Input
                type="number"
                name="amountCents"
                min="1"
                step="1"
                placeholder="2500"
                required
              />
            </Field>
            <Field label="Reason">
              <Input
                type="text"
                name="reason"
                placeholder="Goodwill credit, return adjustment…"
              />
            </Field>
            <div className="flex items-end">
              <ButtonSubmit>Issue credit</ButtonSubmit>
            </div>
          </Form>
        )}

        {storeCredit.entries.length === 0 ? (
          <p className="text-text-muted text-sm">No ledger activity yet.</p>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Date</Th>
                <Th>Reason</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Balance</Th>
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
                  <Td>{entry.reason ?? entry.referenceType ?? 'Adjustment'}</Td>
                  <Td
                    className={clsx(
                      'text-right font-medium',
                      entry.amountCents >= 0 ? 'text-success' : 'text-danger'
                    )}
                  >
                    {entry.amountCents >= 0 ? '+' : ''}
                    {formatCents(entry.amountCents)}
                  </Td>
                  <Td className="text-text text-right">
                    {formatCents(entry.balanceAfterCents)}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </SectionCard>

      {/* GDPR & Privacy */}
      <SectionCard
        title="GDPR & privacy"
        description="Manage consent preferences and data requests."
      >
        {customer.erasedAt ? (
          <p className="text-warn text-sm">
            This customer was erased on{' '}
            {new Date(customer.erasedAt).toLocaleString('en')}. Personal data
            has been anonymized; order history is preserved.
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
                Analytics consent
              </label>
              <label className="text-text flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="marketing"
                  defaultChecked={customer.consent.marketing}
                />
                Marketing consent
              </label>
              <Button type="submit" variant="primary">
                Save consent
              </Button>
            </Form>

            <div className="border-border flex flex-wrap gap-3 border-t pt-4">
              <Form method="post">
                <input type="hidden" name="intent" value="export-data" />
                <Button type="submit" variant="secondary">
                  Export customer data (JSON)
                </Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="erase-customer" />
                <Button
                  type="submit"
                  variant="danger"
                  onClick={(e) => {
                    if (
                      !confirm(
                        "Permanently erase this customer's personal data? Orders will be anonymized but preserved."
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  Erase personal data
                </Button>
              </Form>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Order History */}
      <SectionCard
        title="Order history"
        description="Recent orders placed by this customer."
      >
        {customer.orders.length === 0 ? (
          <p className="text-text-muted text-sm">No orders yet.</p>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Order #</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
                <Th>Date</Th>
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
                    <StatusBadge status={order.status} />
                  </Td>
                  <Td className="text-text text-right">
                    {formatCents(order.totalCents, order.currency)}
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
