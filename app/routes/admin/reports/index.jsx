// app/routes/admin/reports/index.jsx
// Sales analytics dashboard with date-range filters and export controls.

import { Form, Link, useLoaderData, useSearchParams } from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';
import { getDashboardReport } from '#/core/reporting/index.server';
import {
  EXPORT_SCHEDULES,
  EXPORT_TYPES,
  listScheduledExports,
  createScheduledExport,
  deleteScheduledExport,
  queueScheduledExport,
} from '#/core/exports/index.server';
import { recordAdminAudit } from '#/core/audit/index.server';

export function meta() {
  return [
    { title: 'Reports — Admin' },
    { name: 'description', content: 'Store analytics and data exports' },
  ];
}

export async function loader({ request }) {
  await authenticate(request);
  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate') ?? undefined;
  const endDate = url.searchParams.get('endDate') ?? undefined;

  const [report, scheduledExports] = await Promise.all([
    getDashboardReport({ startDate, endDate }),
    listScheduledExports(),
  ]);

  return {
    report,
    scheduledExports: scheduledExports.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      lastRunAt: s.lastRunAt?.toISOString() ?? null,
      runs: s.runs.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
    })),
    filters: { startDate: startDate ?? '', endDate: endDate ?? '' },
    exportTypes: EXPORT_TYPES,
    exportSchedules: EXPORT_SCHEDULES,
  };
}

export async function action({ request }) {
  const { user } = await authenticate(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create-scheduled-export') {
    const label = formData.get('label')?.toString().trim();
    const exportType = formData.get('exportType')?.toString();
    const schedule = formData.get('schedule')?.toString();
    const recipientEmail =
      formData.get('recipientEmail')?.toString().trim() || null;

    if (!label || !exportType || !schedule) {
      return { ok: false, error: 'Label, export type, and schedule are required.' };
    }

    try {
      const created = await createScheduledExport({
        label,
        exportType,
        schedule,
        recipientEmail,
      });
      await recordAdminAudit({
        user,
        action: 'scheduled_export.created',
        entityType: 'scheduled_export',
        entityId: created.id,
        metadata: { label, exportType, schedule },
      });
      return { ok: true, intent };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (intent === 'run-scheduled-export') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing export id.' };
    queueScheduledExport({ scheduledExportId: id });
    await recordAdminAudit({
      user,
      action: 'scheduled_export.queued',
      entityType: 'scheduled_export',
      entityId: id,
    });
    return { ok: true, intent };
  }

  if (intent === 'delete-scheduled-export') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing export id.' };
    await deleteScheduledExport(id);
    await recordAdminAudit({
      user,
      action: 'scheduled_export.deleted',
      entityType: 'scheduled_export',
      entityId: id,
    });
    return { ok: true, intent };
  }

  return { ok: false, error: 'Unknown intent.' };
}

function formatCents(cents) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="dark:border-dark-700 dark:bg-dark-800 rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</p>
      )}
    </div>
  );
}

export default function AdminReportsRoute() {
  const { report, scheduledExports, filters, exportTypes, exportSchedules } =
    useLoaderData();
  const [searchParams] = useSearchParams();
  const { overview, salesOverTime, salesByProduct, salesByCategory } = report;

  const exportQuery = new URLSearchParams();
  if (filters.startDate) exportQuery.set('startDate', filters.startDate);
  if (filters.endDate) exportQuery.set('endDate', filters.endDate);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Reports
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Sales analytics, tax, discounts, and data exports.
        </p>
      </div>

      <Form
        method="get"
        className="dark:border-dark-700 dark:bg-dark-800 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Start date
          </label>
          <input
            type="date"
            name="startDate"
            defaultValue={filters.startDate}
            className="rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            End date
          </label>
          <input
            type="date"
            name="endDate"
            defaultValue={filters.endDate}
            className="rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Apply
        </button>
      </Form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Revenue"
          value={formatCents(overview.revenueCents)}
          sub={`${overview.paidOrders} paid orders`}
        />
        <MetricCard
          label="Average order value"
          value={formatCents(overview.aovCents)}
        />
        <MetricCard
          label="Tax collected"
          value={formatCents(overview.taxCents)}
        />
        <MetricCard
          label="Discounts applied"
          value={formatCents(overview.discountCents)}
        />
        <MetricCard
          label="Refunds"
          value={formatCents(overview.refundCents)}
          sub={`${overview.refundCount} refunds`}
        />
        <MetricCard
          label="Total orders"
          value={overview.orderCount.toLocaleString('en')}
        />
        <MetricCard
          label="Checkout conversion"
          value={`${overview.conversionRate}%`}
          sub={`${overview.completedCheckouts} / ${overview.startedCheckouts} sessions`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReportTable
          title="Sales over time"
          headers={['Date', 'Orders', 'Revenue', 'Tax', 'Discounts']}
          rows={salesOverTime.map((row) => [
            row.date,
            row.orders,
            formatCents(row.revenueCents),
            formatCents(row.taxCents),
            formatCents(row.discountCents),
          ])}
          empty="No sales in this period."
        />
        <ReportTable
          title="Top products"
          headers={['Product', 'Qty', 'Revenue']}
          rows={salesByProduct.map((row) => [
            row.title,
            row.quantity,
            formatCents(row.revenueCents),
          ])}
          empty="No product sales in this period."
        />
        <ReportTable
          title="Sales by category"
          headers={['Category', 'Revenue']}
          rows={salesByCategory.map((row) => [
            row.title,
            formatCents(row.revenueCents),
          ])}
          empty="No category sales in this period."
        />
      </div>

      <section className="dark:border-dark-700 dark:bg-dark-800 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          CSV exports
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Download data immediately or schedule recurring exports.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {exportTypes.map((type) => {
            const params = new URLSearchParams(exportQuery);
            params.set('type', type);
            return (
              <a
                key={type}
                href={`/admin/reports/export?${params.toString()}`}
                className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 ring-1 ring-gray-300 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-600 dark:hover:bg-zinc-700"
              >
                Export {type}
              </a>
            );
          })}
        </div>

        <Form method="post" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="intent" value="create-scheduled-export" />
          <input
            type="text"
            name="label"
            placeholder="Schedule label"
            required
            className="rounded-md border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
          <select
            name="exportType"
            required
            className="rounded-md border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          >
            {exportTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            name="schedule"
            required
            className="rounded-md border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          >
            {exportSchedules.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="email"
            name="recipientEmail"
            placeholder="Recipient email (optional)"
            className="rounded-md border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 sm:col-span-2 lg:col-span-1"
          >
            Schedule export
          </button>
        </Form>

        {scheduledExports.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
              <thead>
                <tr>
                  {['Label', 'Type', 'Schedule', 'Last run', 'Actions'].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {scheduledExports.map((exp) => (
                  <tr key={exp.id}>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                      {exp.label}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 dark:text-zinc-300">
                      {exp.exportType}
                    </td>
                    <td className="px-3 py-2 text-sm capitalize text-gray-600 dark:text-zinc-300">
                      {exp.schedule}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500 dark:text-zinc-400">
                      {exp.lastRunAt
                        ? new Date(exp.lastRunAt).toLocaleString('en')
                        : 'Never'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Form method="post" className="inline">
                          <input
                            type="hidden"
                            name="intent"
                            value="run-scheduled-export"
                          />
                          <input type="hidden" name="id" value={exp.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            Run now
                          </button>
                        </Form>
                        {exp.runs[0]?.status === 'completed' && (
                          <Link
                            to={`/admin/reports/export?runId=${exp.runs[0].id}`}
                            className="text-xs font-medium text-gray-600 hover:underline dark:text-zinc-300"
                          >
                            Download
                          </Link>
                        )}
                        <Form method="post" className="inline">
                          <input
                            type="hidden"
                            name="intent"
                            value="delete-scheduled-export"
                          />
                          <input type="hidden" name="id" value={exp.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                          >
                            Delete
                          </button>
                        </Form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ReportTable({ title, headers, rows, empty }) {
  return (
    <div className="dark:border-dark-700 dark:bg-dark-800 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-zinc-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
            <thead>
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="px-3 py-2 text-sm text-gray-700 dark:text-zinc-300"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
