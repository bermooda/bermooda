// app/routes/admin/customers/$id.jsx
// Customer detail — header, edit form, addresses, order history.

import clsx from 'clsx';
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import prisma from '#/libs/prisma.server';
import { authenticate } from '#/libs/auth/admin.server';
import { recordAdminAudit } from '#/core/audit/index.server';
import {
  exportCustomerData,
  eraseCustomer,
  updateCustomerConsent,
  parseConsent,
} from '#/core/gdpr/index.server';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ params }) {
  const { id } = params;

  const customer = await prisma.customer.findUniqueOrThrow({
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
  });

  return {
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

    await prisma.customer.update({
      where: { id },
      data: { name, phone, preferredLocale },
    });

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

    await prisma.$transaction([
      prisma.address.updateMany({
        where: { customerId: id },
        data: { isDefault: false },
      }),
      prisma.address.update({
        where: { id: addressId, customerId: id },
        data: { isDefault: true },
      }),
    ]);

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

    await prisma.address.delete({ where: { id: addressId, customerId: id } });

    await recordAdminAudit({
      user,
      action: 'customer.address.deleted',
      entityType: 'address',
      entityId: addressId,
      metadata: { customerId: id },
    });

    return { ok: true, intent };
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

const ORDER_STATUS_CLASSES = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
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
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        ORDER_STATUS_CLASSES[status] ??
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminCustomerRoute() {
  const { customer } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
          <Link to="/admin/customers" className="hover:underline">
            Customers
          </Link>
          <span>/</span>
          <span className="max-w-xs truncate">{customer.email}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {customer.name ?? customer.email}
          </h1>
          <span className="text-sm text-gray-500 dark:text-zinc-400">
            Joined{' '}
            {new Date(customer.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
        {customer.name && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">
            {customer.email}
          </p>
        )}
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

      {/* Edit Customer */}
      <SectionCard title="Customer Details">
        <Form method="post" className="grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="intent" value="update-customer" />

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-zinc-300">
              Name
            </label>
            <input
              type="text"
              name="name"
              defaultValue={customer.name ?? ''}
              placeholder="Jane Doe"
              className="w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600 dark:placeholder:text-zinc-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-zinc-300">
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              defaultValue={customer.phone ?? ''}
              placeholder="+1 555 000 0000"
              className="w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600 dark:placeholder:text-zinc-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-zinc-300">
              Preferred Locale
            </label>
            <input
              type="text"
              name="preferredLocale"
              defaultValue={customer.preferredLocale ?? ''}
              placeholder="en, de, fr…"
              className="w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600 dark:placeholder:text-zinc-500"
            />
          </div>

          {/* Read-only email */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">
              Email (read-only)
            </label>
            <p className="rounded-md bg-gray-50 px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 ring-inset dark:bg-zinc-800/50 dark:text-zinc-300 dark:ring-zinc-700">
              {customer.email}
            </p>
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
            >
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Form>
      </SectionCard>

      {/* Addresses */}
      <SectionCard title={`Addresses (${customer.addresses.length})`}>
        {customer.addresses.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-zinc-500">
            No addresses saved.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {customer.addresses.map((addr) => (
              <div
                key={addr.id}
                className={clsx(
                  'relative rounded-lg p-4 ring-1',
                  addr.isDefault
                    ? 'ring-indigo-300 bg-indigo-50/50 dark:ring-indigo-700 dark:bg-indigo-900/10'
                    : 'ring-gray-200 bg-gray-50 dark:ring-zinc-700 dark:bg-zinc-800/40'
                )}
              >
                {addr.isDefault && (
                  <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    Default
                  </span>
                )}

                <address className="text-sm text-gray-700 not-italic dark:text-zinc-300">
                  <p className="font-medium">
                    {addr.firstName} {addr.lastName}
                  </p>
                  {addr.company && (
                    <p className="text-gray-500 dark:text-zinc-400">
                      {addr.company}
                    </p>
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
                    <p className="mt-1 text-gray-500 dark:text-zinc-400">
                      {addr.phone}
                    </p>
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
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-50 disabled:opacity-60 dark:text-indigo-400 dark:ring-indigo-700 dark:hover:bg-indigo-900/20"
                      >
                        Set Default
                      </button>
                    </Form>
                  )}
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete-address" />
                    <input type="hidden" name="addressId" value={addr.id} />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      onClick={(e) => {
                        if (!confirm('Delete this address?'))
                          e.preventDefault();
                      }}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:ring-red-700 dark:hover:bg-red-900/20"
                    >
                      Delete
                    </button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* GDPR & Privacy */}
      <SectionCard title="GDPR & Privacy">
        {customer.erasedAt ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            This customer was erased on{' '}
            {new Date(customer.erasedAt).toLocaleString('en')}. Personal data
            has been anonymized; order history is preserved.
          </p>
        ) : (
          <div className="space-y-4">
            <Form method="post" className="flex flex-wrap gap-4">
              <input type="hidden" name="intent" value="update-consent" />
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  name="analytics"
                  defaultChecked={customer.consent.analytics}
                  className="rounded border-gray-300"
                />
                Analytics consent
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  name="marketing"
                  defaultChecked={customer.consent.marketing}
                  className="rounded border-gray-300"
                />
                Marketing consent
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                Save consent
              </button>
            </Form>

            <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-zinc-700">
              <Form method="post">
                <input type="hidden" name="intent" value="export-data" />
                <button
                  type="submit"
                  className="rounded-md px-3 py-2 text-sm font-medium text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-50 dark:text-indigo-400 dark:ring-indigo-700 dark:hover:bg-indigo-900/20"
                >
                  Export customer data (JSON)
                </button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="erase-customer" />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  onClick={(e) => {
                    if (
                      !confirm(
                        'Permanently erase this customer\'s personal data? Orders will be anonymized but preserved.'
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                  className="rounded-md px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:ring-red-700 dark:hover:bg-red-900/20"
                >
                  Erase personal data
                </button>
              </Form>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Order History */}
      <SectionCard title="Order History">
        {customer.orders.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-zinc-500">
            No orders yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800">
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                    Order #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                    Status
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                    Total
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {customer.orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-gray-50 dark:hover:bg-zinc-800/60"
                  >
                    <td className="px-3 py-2">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="font-mono text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-gray-700 dark:text-zinc-300">
                      {formatCents(order.totalCents, order.currency)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500 dark:text-zinc-400">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
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
      </SectionCard>
    </div>
  );
}
