// app/routes/admin/reports/index.jsx
// Sales analytics dashboard with date-range filters and export controls.

import { PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData } from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';
import { recordAdminAudit } from '#/core/audit/index.server';
import { formatPrice } from '#/core/currency/format';
import {
  EXPORT_SCHEDULES,
  EXPORT_TYPES,
  listScheduledExports,
  deleteScheduledExport,
  queueScheduledExport,
} from '#/core/exports/index.server';
import {
  getDashboardReport,
  parseReportParams,
} from '#/core/reporting/index.server';
import { get } from '#/core/settings/index.server';
import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Table, { TBody, Td, Th, THead } from '#/components/admin/table';
import { ButtonSubmit } from '#/components/ui/button';

export function meta() {
  return [
    { title: 'Reports — Admin' },
    { name: 'description', content: 'Store analytics and data exports' },
  ];
}

export async function loader({ request }) {
  await authenticate(request);
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);

  const [report, scheduledExportList, defaultCurrency] = await Promise.all([
    getDashboardReport(params),
    listScheduledExports({ limit: 100 }),
    get('defaultCurrency'),
  ]);

  return {
    report,
    scheduledExports: scheduledExportList.scheduledExports,
    filters: {
      startDate: params.startDate ?? '',
      endDate: params.endDate ?? '',
    },
    defaultCurrency: defaultCurrency ?? 'USD',
    exportTypes: EXPORT_TYPES,
    exportSchedules: EXPORT_SCHEDULES,
  };
}

export async function action({ request }) {
  const { user } = await authenticate(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

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
    try {
      await deleteScheduledExport(id);
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return { ok: false, error: 'Scheduled export not found.' };
      }
      throw err;
    }
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

function MetricCard({ label, value, sub }) {
  return (
    <Card>
      <p className="text-text-muted text-sm font-medium">{label}</p>
      <p className="text-text mt-2 text-2xl font-semibold tracking-tight">
        {value}
      </p>
      {sub && <p className="text-text-muted mt-1 text-xs">{sub}</p>}
    </Card>
  );
}

export default function AdminReportsRoute() {
  const { report, scheduledExports, filters, exportTypes, defaultCurrency } =
    useLoaderData();
  const { overview, salesOverTime, salesByProduct, salesByCategory } = report;

  const exportQuery = new URLSearchParams();
  if (filters.startDate) exportQuery.set('startDate', filters.startDate);
  if (filters.endDate) exportQuery.set('endDate', filters.endDate);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        subtitle="Sales analytics, tax, discounts, and data exports."
      />

      <Card padded={false}>
        <Form
          method="get"
          className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <Field label="Start date" htmlFor="startDate" className="space-y-1">
            <Input
              id="startDate"
              type="date"
              name="startDate"
              defaultValue={filters.startDate}
            />
          </Field>
          <Field label="End date" htmlFor="endDate" className="space-y-1">
            <Input
              id="endDate"
              type="date"
              name="endDate"
              defaultValue={filters.endDate}
            />
          </Field>
          <ButtonSubmit>Apply</ButtonSubmit>
        </Form>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Revenue"
          value={formatPrice(overview.revenueCents, defaultCurrency)}
          sub={`${overview.paidOrders} paid orders`}
        />
        <MetricCard
          label="Average order value"
          value={formatPrice(overview.aovCents, defaultCurrency)}
        />
        <MetricCard
          label="Tax collected"
          value={formatPrice(overview.taxCents, defaultCurrency)}
        />
        <MetricCard
          label="Discounts applied"
          value={formatPrice(overview.discountCents, defaultCurrency)}
        />
        <MetricCard
          label="Refunds"
          value={formatPrice(overview.refundCents, defaultCurrency)}
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
            formatPrice(row.revenueCents, defaultCurrency),
            formatPrice(row.taxCents, defaultCurrency),
            formatPrice(row.discountCents, defaultCurrency),
          ])}
          empty="No sales in this period."
        />
        <ReportTable
          title="Top products"
          headers={['Product', 'Qty', 'Revenue']}
          rows={salesByProduct.map((row) => [
            row.title,
            row.quantity,
            formatPrice(row.revenueCents, defaultCurrency),
          ])}
          empty="No product sales in this period."
        />
        <ReportTable
          title="Sales by category"
          headers={['Category', 'Revenue']}
          rows={salesByCategory.map((row) => [
            row.title,
            formatPrice(row.revenueCents, defaultCurrency),
          ])}
          empty="No category sales in this period."
        />
      </div>

      <Card>
        <h2 className="text-text text-lg font-semibold">CSV exports</h2>
        <p className="text-text-muted mt-1 text-sm">
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
                className="border-border bg-surface text-text hover:bg-surface-2 rounded-md border px-3 py-2 text-sm font-medium shadow-xs"
              >
                Export {type}
              </a>
            );
          })}
        </div>

        <div className="mt-6">
          <Link
            to="/admin/reports/schedules/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            Schedule export
          </Link>
        </div>

        {scheduledExports.length > 0 && (
          <Table className="mt-6">
            <THead>
              <tr>
                {['Label', 'Type', 'Schedule', 'Last run', 'Actions'].map(
                  (col) => (
                    <Th key={col}>{col}</Th>
                  )
                )}
              </tr>
            </THead>
            <TBody>
              {scheduledExports.map((exp) => (
                <tr key={exp.id}>
                  <Td className="text-text font-medium">{exp.label}</Td>
                  <Td>{exp.exportType}</Td>
                  <Td className="capitalize">{exp.schedule}</Td>
                  <Td>
                    {exp.lastRunAt
                      ? new Date(exp.lastRunAt).toLocaleString('en')
                      : 'Never'}
                  </Td>
                  <Td>
                    <div className="flex gap-3">
                      <Form method="post" className="inline">
                        <input
                          type="hidden"
                          name="intent"
                          value="run-scheduled-export"
                        />
                        <input type="hidden" name="id" value={exp.id} />
                        <button
                          type="submit"
                          className="text-accent text-xs font-medium hover:underline"
                        >
                          Run now
                        </button>
                      </Form>
                      {exp.runs[0]?.status === 'completed' && (
                        <Link
                          to={`/admin/reports/export?runId=${exp.runs[0].id}`}
                          className="text-text-muted hover:text-text text-xs font-medium hover:underline"
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
                          className="text-danger text-xs font-medium hover:underline"
                        >
                          Delete
                        </button>
                      </Form>
                    </div>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function ReportTable({ title, headers, rows, empty }) {
  return (
    <Card padded={false}>
      <div className="border-border border-b px-4 py-3">
        <h2 className="text-text text-base font-semibold">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-text-muted px-4 py-6 text-sm">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="divide-border min-w-full divide-y">
            <THead>
              <tr>
                {headers.map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
              </tr>
            </THead>
            <TBody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <Td key={j} className="text-text">
                      {cell}
                    </Td>
                  ))}
                </tr>
              ))}
            </TBody>
          </table>
        </div>
      )}
    </Card>
  );
}
