// app/routes/admin/audit-log.jsx
// Paginated admin audit log viewer.

import { Form, useLoaderData, useSearchParams } from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';
import { listAuditLogs } from '#/core/audit/index.server';

export function meta() {
  return [
    { title: 'Audit Log — Admin' },
    { name: 'description', content: 'Admin mutation and system event audit trail' },
  ];
}

export async function loader({ request }) {
  await authenticate(request);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const action = url.searchParams.get('action') ?? undefined;
  const entityType = url.searchParams.get('entityType') ?? undefined;

  const result = await listAuditLogs({ page, action, entityType });

  return result;
}

export default function AdminAuditLogRoute() {
  const { items, total, page, totalPages } = useLoaderData();
  const [searchParams] = useSearchParams();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {total.toLocaleString('en')} entries — admin mutations and domain
          events.
        </p>
      </div>

      <Form
        method="get"
        className="dark:border-dark-700 dark:bg-dark-800 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Action
          </label>
          <input
            type="text"
            name="action"
            defaultValue={searchParams.get('action') ?? ''}
            placeholder="e.g. order.created"
            className="rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Entity type
          </label>
          <input
            type="text"
            name="entityType"
            defaultValue={searchParams.get('entityType') ?? ''}
            placeholder="e.g. order"
            className="rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Filter
        </button>
      </Form>

      <div className="dark:border-dark-700 dark:bg-dark-800 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
            <thead>
              <tr>
                {[
                  'When',
                  'Actor',
                  'Action',
                  'Entity',
                  'Details',
                ].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-zinc-400"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-500 dark:text-zinc-400"
                  >
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                items.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 dark:hover:bg-zinc-800/60"
                  >
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-500 dark:text-zinc-400">
                      {new Date(entry.createdAt).toLocaleString('en')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-zinc-300">
                      <span className="font-medium capitalize">
                        {entry.actorType}
                      </span>
                      {entry.actorEmail && (
                        <span className="block text-xs text-gray-500 dark:text-zinc-500">
                          {entry.actorEmail}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-white">
                      {entry.action}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-zinc-300">
                      {entry.entityType && (
                        <span>
                          {entry.entityType}
                          {entry.entityId && (
                            <span className="block font-mono text-xs text-gray-500 dark:text-zinc-500">
                              {entry.entityId}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-500 dark:text-zinc-400">
                      {entry.diff
                        ? JSON.stringify(entry.diff)
                        : entry.metadata
                          ? JSON.stringify(entry.metadata)
                          : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-zinc-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page - 1) }).toString()}`}
                className="rounded-md px-3 py-1 ring-1 ring-gray-300 hover:bg-gray-50 dark:ring-zinc-600 dark:hover:bg-zinc-800"
              >
                Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) }).toString()}`}
                className="rounded-md px-3 py-1 ring-1 ring-gray-300 hover:bg-gray-50 dark:ring-zinc-600 dark:hover:bg-zinc-800"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
