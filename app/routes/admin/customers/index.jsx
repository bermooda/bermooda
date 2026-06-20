// app/routes/admin/customers/index.jsx
// Customers admin list — paginated table with email/name search and inline create panel.

import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from 'react-router';

import { containsFilter } from '#/utils/prisma-filters.server';
import prisma from '#/libs/prisma.server';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const q = url.searchParams.get('q')?.trim() ?? '';

  const where = q
    ? {
        OR: [{ email: containsFilter(q) }, { name: containsFilter(q) }],
      }
    : {};

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
      },
    }),
  ]);

  const rows = customers.map((c) => ({
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    phone: c.phone ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    q,
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create') {
    const email = formData.get('email')?.toString().trim() ?? '';
    const name = formData.get('name')?.toString().trim() || null;
    const phone = formData.get('phone')?.toString().trim() || null;

    if (!email) {
      return { ok: false, error: 'Email is required.' };
    }

    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing) {
      return { ok: false, error: 'A customer with that email already exists.' };
    }

    const customer = await prisma.customer.create({
      data: { email, name, phone },
    });

    return redirect(`/admin/customers/${customer.id}`);
  }

  return { ok: false, error: 'Unknown intent.' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminCustomersRoute() {
  const { rows, total, page, totalPages, q } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);

  const isSubmitting = navigation.state === 'submitting';

  function goToPage(p) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Customers
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {total} customer{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {showCreate ? (
            <>
              <XMarkIcon className="h-4 w-4" />
              Cancel
            </>
          ) : (
            <>
              <PlusIcon className="h-4 w-4" />
              Create Customer
            </>
          )}
        </button>
      </div>

      {/* Inline Create Panel */}
      {showCreate && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            New Customer
          </h2>
          {actionData?.error && (
            <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {actionData.error}
            </div>
          )}
          <Form method="post" className="grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="intent" value="create" />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-zinc-300">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="customer@example.com"
                className="w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600 dark:placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-zinc-300">
                Name
              </label>
              <input
                type="text"
                name="name"
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
                placeholder="+1 555 000 0000"
                className="w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-600 dark:placeholder:text-zinc-500"
              />
            </div>
            <div className="flex gap-3 sm:col-span-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
              >
                {isSubmitting ? 'Creating…' : 'Create Customer'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </Form>
        </div>
      )}

      {/* Search */}
      <Form method="get" className="mb-4">
        <div className="relative max-w-sm">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by email or name…"
            className="w-full rounded-md border-0 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:placeholder:text-zinc-500"
          />
        </div>
      </Form>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
          <thead>
            <tr className="bg-gray-50 dark:bg-zinc-800">
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                Phone
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                Created
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-gray-400 dark:text-zinc-500"
                >
                  No customers found.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 dark:hover:bg-zinc-800/60"
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                  {row.email}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-zinc-300">
                  {row.name ?? (
                    <span className="text-gray-400 dark:text-zinc-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-zinc-300">
                  {row.phone ?? (
                    <span className="text-gray-400 dark:text-zinc-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-zinc-400">
                  {new Date(row.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  <Link
                    to={`/admin/customers/${row.id}`}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-zinc-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="rounded-md px-3 py-1.5 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 dark:ring-zinc-700 dark:hover:bg-zinc-800"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="rounded-md px-3 py-1.5 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 dark:ring-zinc-700 dark:hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
